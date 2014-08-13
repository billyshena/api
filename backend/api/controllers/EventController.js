/**
 * EventController.js 
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */
var sanitizer = require('sanitizer');
var async = require('async');

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

    // TODO: USE ASYNC.JS
    nextEvents: function(req,res){
        if (req.param("id")) {
            var events = [];
            User.findOne({
                id: parseInt(req.param("id"))
            }).populate('teams').exec(function(err,user){
                if(err) {
                    return ErrorService.sendError(404, err, req, res);
                }
                if(!user){
                    return ErrorService.sendError(500,'User object not found', req, res);
                }
                function loadEvents(i, callback) {
                    if(user.teams && i < user.teams.length) {
                        Event.find({
                            team: user.teams[i].id,
                            start: {'>': new Date()}
                        }).sort('start ASC').limit(1).exec(function(err, teamEvents) {
                            if(err) {
                                ErrorService.sendError(404, err, req, res);
                            }
                            else {
                                events = events.concat(teamEvents);
                                loadEvents(i+1, callback);
                            }
                        });
                    }
                    else {
                        callback();
                    }
                }
                loadEvents(0, function() {
                    return res.json({event: events});
                });
            });
        }
        else {
            ErrorService.sendError(412, 'Missing paramaters', req, res);
        }
    },


    /**
     * Returns the events of the teams in which the user is
     * @param id
     * @param res
     * @returns {*}
     */
    // TODO: USE ASYNC.JS
    getEvent: function(req,res){
        if (req.param("id")) {
            var events = [];
            User.findOne({
                id: sanitizer.escape(req.param("id"))
            }).populate('teams').exec(function(err,user){
                if(err)
                    ErrorService.sendError(404, err, req, res);
                else{
                    if(user) {
                        function loadEvents(i, callback) {
                            if(user.teams && i < user.teams.length) {
                                Event.find({
                                    team: user.teams[i].id
                                }).exec(function(err, teamEvents) {
                                    if(err) {
                                        return ErrorService.sendError(404, err, req, res);
                                    }
                                    else {
                                        events = events.concat(teamEvents);
                                        loadEvents(i+1, callback);
                                    }
                                });
                            }
                            else {
                                callback();
                            }
                        }
                        loadEvents(0, function() {
                            return res.json(events);
                        })
                    }
                    else {
                        return ErrorService.sendError(500, 'Corrupted user', req, res);
                    }
                }
            });
        }
        else {
            return ErrorService.sendError(412, 'Missing paramaters', req, res);
        }
    },

    getEventsOnDay: function(req,res){
        if(req.param("date")){
            Date.prototype.yyyymmdd = function() {
                var yyyy = this.getFullYear().toString();
                var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
                var dd  = this.getDate().toString();
                return yyyy + '-'+ (mm[1]?mm:"0"+mm[0]) + '-'+ (dd[1]?dd:"0"+dd[0]); // padding
            };
            Event
            .find()
            .populate('team')
            .exec(function(err,events){
                    if(err){
                        return console.log(err);
                    }
                    var results = [];
                    async.each(
                        events,
                        function(event,callback){
                            var date = event.start.yyyymmdd();
                            if(date === req.param("date")){
                                results.push(event);
                            }
                            callback();
                        },
                        function(err){
                            if(err){
                                return console.log(err);
                            }
                            res.json(results);
                    });
            });
        }
    },


    /** Function to update personal events for students and teachers **/
    updatePersonalEvent: function(req,res){
        if(req.param("id") && req.param("title") && req.param("start") && req.param("end")){
            Event.findOne({
                id: sanitizer.escape(req.param("id"))
            }).exec(function(err,result){
                if(err){
                    return console.log(err);
                }
                /** Check whether if the user is the owner of the Event or not **/
                else if(result && req.token.id === result.owner){
                    Event.update({
                            id: sanitizer.escape(req.param("id"))
                        },
                        {
                            title: sanitizer.escape(req.param("title")),
                            start: sanitizer.escape(req.param("start")),
                            end: sanitizer.escape(req.param("end"))
                        }
                    ).exec(function(err,event){
                            if(err){
                                return console.log(err);
                            }
                            else if (event) {
                                res.json(event);
                            }
                        });
                }
            })
        }
    }
};
