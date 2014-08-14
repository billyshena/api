/**
 * ExerciseController
 *
 * @description :: Server-side logic for managing exercises
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */
var sanitizer = require('sanitizer');
var async = require('async');
var fs = require('fs');

module.exports = {

    create: function(req,res){
        if(req.param("name") && req.param("content") && req.param("course")){
            Exercise.create({
                name: req.param("name"),
                content: req.param("content"),
                course: req.param("course"),
                allowHandins: false
            }).exec(function(err,exercise){
                if(err){
                    return ErrorService.sendError(500, err, req, res);
                }
                else if(!exercise){
                    return ErrorService.sendError(500,'Exercise not found', req,res);
                }
                else if(req.param("start") && req.param("end")){
                    // If the dates are incorrect
                    if(req.param("start") > req.param("end") || req.param("end") < new Date()){
                        return ErrorService.sendError(500, err, req, res);
                    }
                    exercise.start = req.param("start");
                    exercise.end = req.param("end");
                    exercise.allowHandins = true;

                    Course.findOne({
                        id: sanitizer.escape(req.param("course"))
                    }).populate('students').exec(function(err,course){
                        if(err){
                            return ErrorService.sendError(500, err, req, res);
                        }
                        if(!course){
                            return ErrorService.sendError(500, 'Course object not found', req, res);
                        }
                        /** LOOP Through each student subscribed to the Course according to the Exercise **/
                        var results = [];
                        async.each(
                            course.students,
                            function addUser(user,callback){
                                /** CREATE A NOTIFICATION FOR EACH USER **/
                                Notification.create({
                                    from: course.owner,
                                    to: user.id,
                                    content: 'exercise',
                                    type: 'share',
                                    picture: '',
                                    link: '/course/' + course.id +'/exercise/'+exercise.id,
                                    viewed: false
                                }).exec(function(err,notif){
                                    if(err){
                                        callback(err);
                                    }
                                    else if(!notif){
                                        callback(err);
                                    }
                                    else {
                                        notif.from = {
                                            firstName: req.token.firstName,
                                            lastName: req.token.lastName,
                                            avatar: req.token.avatar
                                        };
                                        userService.sendNotificationToUser(notif, 'newExercise');
                                        results.push(user.id);
                                        callback();
                                    }
                                });
                            },
                            /** Everything has been done **/
                                function(err){
                                if(err){
                                    return ErrorService.sendError(500,err,req,res);
                                }
                                exercise.notCheckedBy = results;
                                exercise.save(function(err){
                                    if(err){
                                        return ErrorService.sendError(500, err, req, res);
                                    }
                                    return res.json(exercise);
                                });
                            }
                        );
                    });
                }
                else{
                    return res.json(exercise);
                }
            });
        }
        else{
            return ErrorService.sendError(412,'Missing parameters',req,res);
        }
    },

    /** WHENEVER A STUDENT HAS VIEWED THIS EXERCISE **/
    viewed: function(req,res){
        if(req.param("id") && req.param("user")){
            var id = sanitizer.escape(req.param("id"));
            var user = sanitizer.escape(req.param("user"));
            Exercise.findOne({
                id: id
            }).exec(function(err,ex){
                if(err){
                    return ErrorService.sendError(500,err,req,res);
                }
                else if(!ex){
                    return ErrorService.sendError(500,'Exercise object not found', req, res);
                }
                else if(ex.notCheckedBy){
                    // Remove the user from the notCheckedBy array
                    var index = ex.notCheckedBy.indexOf(parseInt(user));
                    // if the user id exists, we remove it (the user has now viewed the exercise)
                    if(index > -1){
                        ex.notCheckedBy.splice(index,1);
                        ex.save(function(err){
                            if(err){
                                return ErrorService.sendError(500,err,req,res);
                            }
                        });
                    }
                    return res.json(200);
                }
                else{
                    return ErrorService.sendError(500,'Exercise does not have notCheckedBy attribute',req,res);
                }
            });
        }
        else{
            return ErrorService.sendError(412,'Missing parameters',req,res);
        }
    }
};

