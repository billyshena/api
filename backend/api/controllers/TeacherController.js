/**
 * TeacherController.js
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */
var sanitizer = require('sanitizer');
var async = require('async');

module.exports = {

    /**
     * Get all handins + files attached for the specified Exercise
     * @param id
     * @param res
     */
    getHandInsFiles: function (req, res) {
        if (req.param("id")) {
            Exercise
                .findOne({ id: sanitizer.escape(req.param("id")) })
                .populate('handIns')
                .exec(function (err, exercise) {
                    if (err) {
                        return ErrorService.sendError(404, err, req, res);
                    }
                    else {
                        async.map(
                            exercise.handIns,
                            function getFiles(handIn, callback) {
                                HandIn
                                    .findOne({ id: handIn.id })
                                    .populate('owner')
                                    .populate('files')
                                    .exec(function (err, handIn) {
                                        if (err) {
                                            callback(err,null);
                                        }
                                        if(!handIn){
                                            callback(null,null);
                                        }
                                        callback(null, handIn);
                                });
                            },
                            function (err, results) {
                                if(err){
                                    return ErrorService.sendError(500, err, req, res);
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
                        else {
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
                            res.json(results);
                        }
                    })
                }
            });
        }
    },


    /**
     * Get all teacher's events of the current day
     * @param owner
     * @param res
     */
    getEventsOfTheDay: function (req, res) {
        if (req.token.id) {
            Event.find({
                teacher: sanitizer.escape(req.token.id)
            }).populate('team').exec(function (err, events) {
                if (err) {
                    return ErrorService.sendError(404, err, req, res);
                }
                else {
                    var currentDate = new Date();
                    var absences = [];
                    async.each(events, function (event, callback) {
                            var date = new Date(event.start);
                            // if event date == current date, we save the absences to display the running events on the current day
                            if ((currentDate.getMonth() + 1) == (date.getMonth() + 1)
                                && (currentDate.getFullYear()) == (date.getFullYear())
                                && (currentDate.getDate()) == (date.getDate())) {
                                absences.push(event);
                            }
                            callback();
                        },
                        /** EVERYTHING HAS BEEN DONE **/
                            function (err) {
                            if (err) {
                                return ErrorService.sendError(500, err, req, res);
                            }
                            res.json(absences);
                        });
                }
            });
        }
    }

};
