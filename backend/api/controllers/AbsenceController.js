/**
 * AbsenceController
 *
 * @description :: Server-side logic for managing absences
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

var fs = require('fs');
var async = require('async');
var sanitizer = require('sanitizer');

module.exports = {

    /** Retrieve all user's absences (student) **/
    userAbsences: function (req, res) {
        if (req.token && req.token.id > 0 && req.param("state")){
            var state = sanitizer.escape(req.param("state"));
            User
                .findOne({ id: req.token.id })
                .populate('absences', {state: state })
                .exec(function (err, user) {
                    if (err) {
                        return ErrorService.sendError(404, err, req, res);
                    }
                    if(!user){
                        return ErrorService.sendError(400, "Utilisateur non trouvé", req, res);
                    }
                    /** We loop on each User's absence **/
                    var results = [];
                    async.each(
                        user.absences,
                        function getAbsence(absence, callback) {
                            Absence.findOne({
                                id: absence.id,
                                owner: req.token.id
                            }).exec(function (err, abs) {
                                if (err) {
                                    callback(err);
                                }
                                if(!abs){
                                    callback(err);
                                }
                                else {
                                    /** Fetch according Event to the Absence object found **/
                                    Event
                                        .findOne({ id: abs.event })
                                        .populate('teacher')
                                        .exec(function (err, event) {
                                            if (err) {
                                                callback(err);
                                            }
                                            else if (!event) {
                                                callback(err);
                                            }
                                            else {
                                                abs.event = event;
                                                results.push(abs);
                                                callback();
                                            }
                                        });
                                }
                            });
                        },
                        /** When everything has been done **/
                            function (err) {
                            if (err) {
                                return ErrorService.sendError(500, err, req, res);
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


    /** CREATE A NEW ABSENCE FOR ALL SELECTED STUDENTS **/
    newAbsence: function (req, res) {
        if (req.param("students") && req.param("event") && req.token.id) {
            var eventId = sanitizer.escape(req.param("event"));
            Event.findOne({
                id: eventId
            }).populate('absences').exec(function (err, event) {
                if (err) {
                    return ErrorService.sendError(404, err, req, res);
                }
                if(!event){
                    return res.notFound();
                }
                /** If Event owner is the current User's one **/
                if(event.teacher === req.token.id) {
                    /** If no Absence objects exist , we create them **/
                    if (event.absences.length == 0 && !event.absenceDone) {
                        /** Loop trough the students who did not attend to the event **/
                        async.each(
                            req.param("students"),
                            function (user, callback) {
                                Absence.create({
                                    event: eventId,
                                    owner: user,
                                    state: 'pending'
                                }).exec(callback);
                            },
                            /** EVERYTHING HAS BEEN DONE **/
                                function (err) {
                                if (err) {
                                    return ErrorService.sendError(500, err, req, res);
                                }
                                /** Update the Event to done **/
                                Event.update({
                                    id: event.id
                                }, {absenceDone: true }).exec(function (err) {
                                    if (err) {
                                        return ErrorService.sendError(500, err, req, res);
                                    }
                                    res.json({
                                        message: 'create',
                                        event: event.id
                                    });
                                });
                            }
                        );
                    }
                    /** The Event already has absences, we just update it then **/
                    else {
                        async.each(
                            event.absences,
                            function (absence, callback) {
                                Absence
                                    .destroy({
                                        id: absence.id
                                    })
                                    .exec(callback);
                            },
                            function (err) {
                                if (err) {
                                    return ErrorService.sendError(500, err, req, res);
                                } else {
                                    /** Loop trough the students who did not attend to the event **/
                                    async.each(
                                        req.param("students"),
                                        function (user, callback) {
                                            Absence
                                                .create({
                                                    event: eventId,
                                                    owner: user,
                                                    state: 'pending'
                                                })
                                                .exec(callback);
                                        },
                                        /** EVERYTHING HAS BEEN DONE **/
                                            function (err) {
                                            if (err) {
                                                return ErrorService.sendError(500, err, req, res);
                                            }
                                            res.json({
                                                message: 'update'
                                            });
                                        });
                                }
                            }
                        );
                    }
                }
            });
        }
        else{
            return ErrorService.sendError(412,'Missing parameters', req, res);
        }
    },

};

