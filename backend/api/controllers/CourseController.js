/**
 * LessonController.js 
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */

var async = require('async');
var sanitizer = require('sanitizer');
var bcrypt = require('bcrypt');
var fs = require('fs');
module.exports = {

    // TODO: Optimize this function
    create: function(req,res){
        if (req.token.id && req.param("name") && req.param("content") && req.param("subject")) {
            Subject.findOne({
                id: sanitizer.escape(req.param("subject").id)
            }).exec(function(err,subject){
                if(err){
                    return ErrorService.sendError(500,err,req,res);
                }
                /** If the subject doesnt exist **/
                else if(!subject){
                    return ErrorService.sendError(400,"Subject not found",req,res);
                }
                else {
                    Course.create({
                        owner: req.token.id,
                        name: req.param("name"),
                        content: req.param("content"),
                        subject: subject.id,
                        password: req.param("password")
                    }).exec(function (err, course) {
                        if (err) {
                            return ErrorService.sendError(500, err, req, res);
                        }
                        if (!course) {
                            return ErrorService.sendError(400, 'Course object not found', req, res);
                        }
                        /** Create a new directory for the created Course on the FileSystem **/
                        var path = sails.config.appPath + '/files/courses/' + course.id;

                        // If Path doesnt exist, we create it **/
                        if (!fs.existsSync(path)) {
                            fs.mkdirSync(path);
                        }

                        var results = []; // array containing all users of each team
                        var teams = [];
                        /** If the user has selected Teams  **/
                        if (req.param("teams") && req.param("teams").length > 0) {
                            teams = req.param("teams");
                        }
                        /** LOOP ON EACH SELECTED TEAM **/
                        async.each(teams, function (teamId, callback) {
                                Team.findOne({
                                    id: parseInt(teamId)
                                }).populate('users').exec(function (err, team) {
                                    if (err) {
                                        callback(err);
                                    }
                                    else if (!team) {
                                        callback(err);
                                    }
                                    else {
                                        /** LOOP ON EACH USER INSIDE THE CURRENT TEAM **/
                                        async.each(team.users, function (user, callback2) {
                                                if (results.indexOf(user.id) == -1) {
                                                    results.push(user.id);
                                                    course.students.add(user.id);

                                                    /** CREATE A NOTIFICATION FOR EACH USER **/
                                                    Notification.create({
                                                        from: course.owner,
                                                        to: user.id,
                                                        content: 'course',
                                                        type: 'share',
                                                        picture: '',
                                                        link: '/course/' + course.id,
                                                        viewed: false
                                                    }).exec(function (err, notif) {
                                                        if (err) {
                                                            callback2(err);
                                                        }
                                                        else if (!notif) {
                                                            callback2(err);
                                                        }
                                                        else {
                                                            notif.from = {
                                                                firstName: req.token.firstName,
                                                                lastName: req.token.lastName,
                                                                avatar: req.token.avatar,
                                                                id: req.token.id
                                                            };
                                                            notif.course = course;
                                                            userService.sendNotificationToUser(notif, 'newCourse');
                                                        }
                                                    });
                                                }
                                                callback2();
                                            },
                                            function (err) {
                                                if (err) {
                                                    return ErrorService.sendError(500, err, req, res);
                                                }
                                            }
                                        );
                                    }
                                    callback();
                                });
                            },
                            function (err) {
                                if (err) {
                                    return ErrorService.sendError(500, err, req, res);
                                }
                                /** WHEN EVERYTHING HAS BEEN DONE **/
                                course.save(function (err) {
                                    if (err) {
                                        return ErrorService.sendError(500, err, req, res);
                                    }
                                    /** RETURN THE COURSE OBJECT TO THE VIEW **/
                                    Course.findOne({
                                        id: course.id
                                    }).populate('subject').exec(function (err, result) {
                                        if (err) {
                                            return ErrorService.sendError(500, err, req, res);
                                        }
                                        if (!result) {
                                            return ErrorService.sendError(400, 'Course object not found', req, res);
                                        }
                                        return res.json(result);
                                    });
                                });
                            });
                    });
                }
            });
        }
    },


    // Function to get all courses where the current user is subscribed to
    getUserCourses: function(req,res) {
        if (req.token && req.token.id > 0) {
            User.findOne({
                id: req.token.id
            }).populate('courses').exec(function (err, user) {
                if(err){
                    return ErrorService.sendError(500, err, req, res);
                }
                if(!user){
                    return ErrorService.sendError(500, 'User object not found', req, res);
                }
                var results = [];
                async.each(
                    user.courses,
                    function findCourse(course,callback){
                        Course
                            .findOne({ id: course.id })
                            .populate('owner')
                            .populate('subject')
                            .exec(function(err,course){
                                if(err){
                                    callback(err);
                                }
                                else if(!course){
                                    callback(err);
                                }
                                else{
                                    results.push(course);
                                    callback();
                                }
                            });
                    },
                    /** When everything has been done **/
                        function(err){
                        if(err){
                            return ErrorService.sendError(500,err, req, res);
                        }
                        return res.json(results);
                    }
                );
            });
        }
        else{
            return ErrorService.sendError(412,'Missing parameters',req,res);
        }
    },


    // Subscribe to a specific course
    subscribe: function(req,res){
        if(req.token.id && req.param("course") && req.param("password")){
            var course = sanitizer.escape(req.param("course"));
            User
                .findOne({ id: req.token.id })
                .populate('courses',{id: course})
                .exec(function(err,user){
                    if(err){
                        return ErrorService.sendError(500,err, req , res);
                    }
                    if(!user){
                        return ErrorService.sendError(500,'User object not found', req , res);
                    }
                    /** User is not subscribed to this course yet, we can add it in the association **/
                    if(user.courses && user.courses.length === 0){
                        Course
                            .findOne({ id: course })
                            .populate('subject')
                            .populate('students')
                            .exec(function(err,course){
                                if(err){
                                    return ErrorService.sendError(500,err,req , res);
                                }
                                if(!course){
                                    return ErrorService.sendError(500,'Course object not found',req , res);
                                }
                                if(course.password){
                                    // Compare password from the form params to the encrypted password of the course found.
                                    bcrypt.compare(req.param('password'), course.password, function(err, valid) {
                                        if (err) {
                                            return ErrorService.sendError(400, err, req, res);
                                        }
                                        // If the password from the form doesn't match the password from the database...
                                        if (!valid) {
                                            return ErrorService.sendError(600, err, req, res);
                                        }
                                        course.students.add(user.id);
                                        course.save(function(err){
                                            if(err){
                                                return ErrorService.sendError(500,err,req,res);
                                            }
                                            return res.json(course);
                                        });
                                    });
                                }
                                else {
                                    course.students.add(user.id);
                                    course.save(function (err) {
                                        if (err) {
                                            return ErrorService.sendError(500,err,req,res);
                                        }
                                        return res.json(course);
                                    });
                                }
                            });
                    }
                    else{
                        /** If the user is already subscribed to the course, we send back a JSON error message **/
                        return ErrorService.sendError(500, err, req, res);
                    }
                });
        }
        else{
            return ErrorService.sendError(412,'Missing parameters', req, res);
        }
    },

    /** Remove the Course + its contents, exercises and corrections **/
    destroy: function(req,res){
        if(req.param("course") && req.token.id){
            var courseId = sanitizer.escape(req.param("course"));
            Course.destroy({
                id: courseId,
                owner: sanitizer.escape(req.token.id)
            }).exec(function(err,course){
                if(err){
                    return ErrorService.sendError(500,err, req, res);
                }
                if(!course){
                    return ErrorService.sendError(500,'Course object not found', req, res);
                }
                /** Remove in parallel all associated items to the Course **/
                async.parallel(
                    {
                        /** GET THE LATEST HOMEWORKS **/
                        contents: function (callback) {
                            Content.destroy({
                                course: courseId
                            }).exec(function (err, contents) {
                                callback(err, contents);
                            });

                        },

                        /** GET THE LATEST POSTS **/
                        exercises: function (callback) {
                            Exercise.destroy({
                                course: courseId
                            }).exec(function (err, exercises) {
                                callback(err, exercises);
                            })

                        },

                        /** GET THE LATEST SHARED FILES **/
                        corrections: function (callback) {
                            Correction.destroy({
                                course: courseId
                            }).exec(function (err, corrections) {
                                callback(err, corrections);
                            });

                        }
                    },

                    /**
                     * Callback that is called after all parallel jobs are done or some error has occurred
                     * within processing those.
                     *
                     * @param   {null|string}   error   Possible error
                     **/
                        function (error, data) {
                        if (error) {
                            return ErrorService.sendError(500, err, req, res);
                            // An error occurred
                        }
                        return res.json({
                            message: 'delete'
                        });
                    }
                );
            });
        }
        else{
            return ErrorService.sendError(412,'Missing parameters', req, res);
        }
    },


    count: function(req,res){
        if(req.param("id")){
            var courseId = parseInt(sanitizer.escape(req.param("id")));
            async.parallel({
                    contents: function (callback) {
                        Content.count({
                            course: courseId
                        }).exec(function(err,contents){
                            callback(err,contents);
                        });
                    },

                    exercises: function(callback){
                        Exercise.count({
                            course: courseId
                        }).exec(function(err,exercises){
                            callback(err,exercises);
                        });
                    },

                    corrections: function(callback){
                        Correction.count({
                            course: courseId
                        }).exec(function(err,corrections){
                            callback(err,corrections);
                        });
                    }
                },

                function(err,data){
                    if(err){
                        return ErrorService.sendError(500,err,req,res);
                    }
                    return res.json(data);
                }
            )
        }
        else{
            return ErrorService.sendError(412,'Missing parameters', req, res);
        }
    }
};
