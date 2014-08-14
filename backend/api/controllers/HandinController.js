/**
 * HandinController
 *
 * @description :: Server-side logic for managing handins
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */
var sanitizer = require('sanitizer');
var fs = require('fs');
var async = require('async');
module.exports = {

    /**
     * Attach files to a content object
     * @param owner
     * @param course
     * @param exercise
     * @param teacher
     * @param res
     * @returns {*}
     */
    attachFiles: function(req,res){
        if(req.token.id && req.param("course") && req.param("exercise") && req.param("teacher")){
            var owner = sanitizer.escape(req.token.id);
            var course = sanitizer.escape(req.param("course"));
            var exercise = sanitizer.escape(req.param("exercise"));
            var teacher = sanitizer.escape(req.param("teacher"));

            var path = sails.config.appPath + '/files/courses/' + course + '/exercise'+exercise+'/' ;

            // If the user's directory doesn't exist, we create it
            if (!fs.existsSync(path)) {
                console.log('creating folder');
                fs.mkdirSync(path);
            }
            HandIn.findOne({
                owner: owner,
                teacher: teacher,
                exercise: exercise,
                course: course
            }).exec(function(err,handin){
                if(err){
                    return ErrorService.sendError(404, err, req, res);
                }
                // if the handin does not exist, we create it
                else if(!handin){
                    HandIn.create({
                        owner: owner,
                        teacher: teacher,
                        exercise: exercise,
                        course: course
                    }).exec(function(err,h){
                        if(err){
                            return ErrorService.sendError(404, err, req, res);
                        }
                        else{
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
                                        handIn: h.id,
                                        exercise: h.exercise,
                                        course: h.course
                                    }).exec(function (err, f) {
                                        // If error
                                        if (err) {
                                            return ErrorService.sendError(404, err, req, res);
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
                                    if (err){
                                        return ErrorService.sendError(404, err, req, res);
                                    }
                                    res.json(result);
                                }
                            );
                        }
                    });
                }
                // handin already exist, we update it
                else{
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
                                handIn: handin.id,
                                exercise: handin.exercise,
                                course: handin.course
                            }).exec(function (err, f) {
                                // If error
                                if (err) {
                                    return ErrorService.sendError(404, err, req, res);
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
                            if (err) {
                                return ErrorService.sendError(404, err, req, res);
                            }
                            res.json(result);
                        }
                    );
                }
            });
        }
        else
            return ErrorService.sendError(412, 'Missing parameters', req, res);
    },


    /**
     * Get all exercices where 1) Current user is subscribed to and 2) Exercise allowHandin set to true
     * @param owner
     * @param res
     * @returns {*}
     */
    get: function(req,res){
        if(req.token.id){
            User
                .findOne({ id: req.token.id })
                .populate('courses')
                .exec(function(err,user){
                    if(err){
                        return ErrorService.sendError(404, err, req, res);
                    }
                    if(!user){
                        return ErrorService.sendError(500,'User object not found', req, res);
                    }
                    async.map(
                        user.courses,
                        function (course, callback) {
                            Exercise
                                .find({
                                    course: course.id,
                                    allowHandins: true,
                                    end: {'>': new Date() }
                                })
                                .populate('handIns', {owner: req.token.id })
                                .exec(function (err, exercises) {
                                    if (err) {
                                        callback(err,null);
                                    }
                                    else if(!exercises){
                                        callback(null,null);
                                    }
                                    else {
                                        course.ex = exercises;
                                        callback(null,course);
                                    }
                                });
                        },
                        function (err,results) {
                            if (err) {
                                return ErrorService.sendError(500,err,req,res);
                            }
                            return res.json(results);
                        }
                    );
                });
        }
        else {
            return ErrorService.sendError(412, 'Missing parameters', req, res);
        }
    },

    /** Get all HandIns according to the Exercise and fetch the attached files on each HandIn Object **/
    getHandInsFiles: function (req, res) {
        if (req.param("id")) {
            Exercise.findOne({
                id: sanitizer.escape(req.param("id"))
            }).populate('handIns').exec(function (err, exercise) {
                if (err) {
                    return ErrorService.sendError(404, err, req, res);
                }
                else {
                    async.map(
                        exercise.handIns,
                        function getFiles(handIn, callback) {
                            HandIn.findOne({
                                id: handIn.id
                            }).populate('owner').populate('files').exec(function (err, handins) {
                                if (err) {
                                    callback(err,null);
                                }
                                else if(!handins){
                                    callback(null,null);
                                }
                                else {
                                    callback(null, handins);
                                }
                            });
                        },
                        function (err, results) {
                            if(err){
                                return ErrorService.sendError(500,err,req,res);
                            }
                            return res.json(results);
                        }
                    );
                }
            });
        }
    },


    /**
     * Function to display all students who did not give back the handIn yet
     * @param exercise
     * @param course
     * @param res
     */
    noHandIns: function (req, res) {
        if (req.param("exercise") && req.param("course")) {

            var exercise = sanitizer.escape(req.param("exercise"));
            var course = sanitizer.escape(req.param("course"));

            Course.findOne({
                id: course
            }).populate('students').exec(function (err, course) {
                if (err) {
                    return ErrorService.sendError(404, err, req, res);
                }
                else {
                    HandIn.find({
                        exercise: exercise,
                        course: course.id
                    }).populate('owner').exec(function (err, handins) {
                        if (err) {
                            return ErrorService.sendError(404, err, req, res);
                        }
                        if(!handins){
                            return ErrorService.sendError(500,'HandIns objects not found',req,res);
                        }
                        var results = []; // all students who did not deposit the handin yet
                        for (var i = 0; i < course.students.length; i++) {
                            var found = false;
                            for (var j = 0; j < handins.length; j++) {
                                if (course.students[i].id == handins[j].owner.id) {
                                    found = true;
                                    break;
                                }
                            }
                            // No handIns deposited by the current user
                            if (!found) {
                                results.push(course.students[i]);
                            }
                        }
                        return res.json(results);
                    });
                }
            });
        }
    }
};

