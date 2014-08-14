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
     * Get all exercices where 1) Current user is subscribed to and 2) Exercise allowHandin set to true
     *                                      3) HandIns that are not finished yet
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
                    var results = [];
                    async.each(
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
                                        callback(err);
                                    }
                                    else if(!exercises){
                                        callback(null);
                                    }
                                    else {
                                        course.ex = exercises;
                                        results.push(course);
                                        callback();
                                    }
                                });
                        },
                        function (err) {
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
                if(!exercise){
                    return ErrorService.sendError(500,'Exercise object not found',req,res);
                }
                var results = [];
                async.each(
                    exercise.handIns,
                    function getFiles(handIn, callback) {
                        HandIn.findOne({
                            id: handIn.id
                        }).populate('owner').populate('files').exec(function (err, handins) {
                            if (err) {
                                callback(err);
                            }
                            else if(!handins){
                                callback(err);
                            }
                            else {
                                results.push(handins);
                                callback();
                            }
                        });
                    },
                    function (err) {
                        if(err){
                            return ErrorService.sendError(500,err,req,res);
                        }
                        return res.json(results);
                    }
                );

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

