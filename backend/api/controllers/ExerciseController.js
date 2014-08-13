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
                if(!exercise){
                    return ErrorService.sendError(500,'Exercise not found', req,res);
                }
                if(req.param("start") && req.param("end")){
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
                       async.map(
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
                                       callback(err,null);
                                   }
                                   if(!notif){
                                       callback(err,null);
                                   }
                                   notif.from = {
                                       firstName: req.token.firstName,
                                       lastName: req.token.lastName,
                                       avatar: req.token.avatar
                                   };
                                   userService.sendNotificationToUser(notif,'newExercise');
                                   callback(null,user.id);
                               });
                           },
                           /** Everything has been done **/
                           function(err,results){
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

    /** ATTACH FILES TO A CONTENT OBJECT **/
    attachFiles: function(req,res){
        if(req.param("id") && req.param("course") && req.token.id){
            var id = sanitizer.escape(req.param("id"));
            var course = sanitizer.escape(req.param("course"));

            var path = sails.config.appPath + '/files/courses/' + req.param('course') + '/';

            // If the user's directory doesn't exist, we create it
            if (!fs.existsSync(path)) {
                fs.mkdirSync(path);
            }
            Exercise.findOne({
                id: id,
                course: course
            }).exec(function(err,exercise){
                if(err){
                    return ErrorService.sendError(500,err,req,res);
                }
                else if(exercise){
                    var result = []; // all files that have been uploaded
                    var options = {
                        dirname: path,
                        saveAs: function (file) {
                            return require('crypto').createHash('md5').update(file.filename).digest("hex");
                        },
                        completed: function (file, next) {
                            // Adding the file to the DB
                            File.create({
                                name: file.name,
                                realName: file.realName,
                                permission: 'private',
                                mimeType: file.mimeType,
                                size: file.size,
                                status: 'ok',
                                exercise: exercise.id,
                                course: exercise.course
                            }).exec(function (err, f) {
                                // If error
                                if (err) {
                                    return ErrorService.sendError(500,err,req,res);
                                }
                                // The File was created successfully!
                                else {
                                    result.push(f);
                                    next();
                                    // TODO : update user's space
                                }
                            });
                        }
                    };

                    req.file('file').upload(Uploader.documentReceiverStream(options),
                        function (err, files) {
                            if (err) return ErrorService.sendError(500,err,req,res);
                            res.json(result);
                        }
                    );
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
                if(!ex){
                    return ErrorService.sendError(500,'Exercise object not found', req, res);
                }

                if(ex.notCheckedBy){
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
            });
        }
        else{
            return ErrorService.sendError(412,'Missing parameters',req,res);
        }
    }
};

