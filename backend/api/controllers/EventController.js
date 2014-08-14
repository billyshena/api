/**
 * EventController.js
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */
var sanitizer = require('sanitizer');
var async = require('async');
var _ = require('lodash');
module.exports = {

    /**
     * Returns events nested with the events parameter
     * @param req.param('start')
     * @param req.param('end')
     * @param res
     */

    getNestedEvent: function(req,res){
        Event.find().where({
            or: [
                {
                    'start': {'<': req.param('start')},
                    'end': {'>': req.param('start')}
                },
                {
                    'start': {'<': req.param('end')},
                    'end': {'>': req.param('end')}
                },
                {
                    'start': req.param('start'),
                    'end': req.param('end')
                }
            ],
            'room': {'!': -1 }
        }).exec(function(err,results){
            if (err) {
                return ErrorService.sendError(500, err, req, res);
            }
            return res.json(results)
        })
    },

    nextEvents: function(req,res){
        if (req.param("id")) {
            User.findOne({
                id: parseInt(req.param("id"))
            }).populate('teams').exec(function(err,user){
                if(err) {
                    return ErrorService.sendError(404, err, req, res);
                }
                if(!user){
                    return ErrorService.sendError(500,'User object not found', req, res);
                }
                var events = [];
                async.each(
                    user.teams,
                    function getEventFromTeam(team,callback){
                        Event
                            .find({
                                team: team.id,
                                start: {'>': new Date() }
                            })
                            .sort('start ASC')
                            .limit(1)
                            .exec(function(err,teamEvents){
                                if(err){
                                    callback(err);
                                }
                                else if(!teamEvents[0]){
                                    callback(err);
                                }
                                else{
                                    events.push(teamEvents[0]);
                                    callback();
                                }
                            });
                    },
                    function(err){
                        if(err){
                            return ErrorService.sendError(500,err,req,res);
                        }
                        return res.json({event: events});
                    }
                );
            });
        }
        else {
            ErrorService.sendError(412, 'Missing parameters', req, res);
        }
    },


    /**
     * Returns the events of the teams in which the user is
     * @param id
     * @param res
     * @returns {*}
     */
    getEvent: function(req,res){
        if (req.param("id")) {
            var events = [];
            User.findOne({
                id: sanitizer.escape(req.param("id"))
            }).populate('teams').exec(function(err,user){
                if(err) {
                    return ErrorService.sendError(404, err, req, res);
                }
                if(!user){
                    return ErrorService.sendError(500,'User object not found',req,res);
                }
                var events = [];
                async.each(
                    user.teams,
                    function getEventFromTeam(team,callback){
                        Event
                            .find({ team: team.id })
                            .exec(function(err,teamEvents){
                                if(err){
                                    callback(err);
                                }
                                else if(!teamEvents){
                                    callback(null);
                                }
                                else{
                                    events = events.concat(teamEvents);
                                    callback();
                                }
                            });
                    },
                    function(err){
                        if(err){
                            return ErrorService.sendError(500,err,req,res);
                        }
                        return res.json(events);
                    }
                );
            });
        }
        else {
            return ErrorService.sendError(412, 'Missing parameters', req, res);
        }
    },


    /** Get all Events running on the current Date (To do Absences) **/
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
                    async.each(
                        events,
                        function (event, callback) {
                            var date = new Date(event.start);
                            if(!event){
                                callback(err);
                            }
                            // if event date == current date, we save the absences to display the running events on the current day
                            else if ((currentDate.getMonth() + 1) == (date.getMonth() + 1) &&
                                (currentDate.getFullYear()) == (date.getFullYear()) &&
                                (currentDate.getDate()) == (date.getDate())) {
                                absences.push(event);
                                callback();
                            }
                            else {
                                callback(null);
                            }
                        },
                        /** EVERYTHING HAS BEEN DONE **/
                            function (err) {
                            if (err) {
                                return ErrorService.sendError(500, err, req, res);
                            }
                            return res.json(absences);
                        }
                    );
                }
            });
        }
    }

};
