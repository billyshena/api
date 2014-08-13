/**
 * HomeworkController.js 
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */

var sanitizer = require('sanitizer');
var async = require('async')
var _ = require('lodash');

module.exports = {
    /**
     * Override the create blueprint action of the API
     * @param owner
     * @param name
     * @param content
     * @param tags
     * @param res
     */
    create: function(req,res){
        if(req.token.id && req.param("name") && req.param("content") && req.param("tags")){
            Homework.create({
                owner: req.token.id,
                name: req.param("name"),
                content: req.param("content"),
                tags: req.param("tags")
            }).exec(function(err,homework){
                if(err){
                    return ErrorService.sendError(404, err, req, res);
                }
                else{
                    Homework.findOne({
                        id: homework.id
                    }).populate('owner').populate('comments').exec(function(err,hw){
                        if(err){
                            return ErrorService.sendError(404, err, req, res);
                        }
                        else {
                            /** Find all users here **/
                            User.find().exec(function(err,users){
                               if(err){
                                   return ErrorService.sendError(404, err, req, res);
                               }
                               else if(users){
                                   async.map(
                                       users,
                                       function(user, callback) {
                                           Notification
                                               .create({
                                                   from: homework.owner,
                                                   to: user.id,
                                                   content:'homework',
                                                   type:'result',
                                                   picture: '',
                                                   link: '/homework/' + homework.id,
                                                   viewed: false
                                               })
                                               .exec(callback);
                                       },
                                       function (error, notifications) {
                                           if (error) {
                                               return ErrorService.sendError(500, err, req, res);
                                           }
                                           else if (notifications && notifications.length > 0) {
                                               _.each(notifications, function(notification) {
                                                   notification.from = {firstName: req.token.firstName, lastName: req.token.lastName };
                                                   notification.homework = hw;
                                                   userService.sendNotificationToUser(notification, 'newHomework');
                                               });

                                               return res.json({
                                                   homework: hw
                                               });
                                           }
                                           else {
                                               return res.json({
                                                   homework: hw
                                               });
                                           }
                                       }
                                   );
                               }
                            });
                        }
                    });
                }
            });
        }
        else
        {
            return ErrorService.sendError(412, 'Missing parameters', req, res);
        }
    },


    /**
     * Function to read a Homework and its comments posted
     * @param id
     * @param res
     * @returns {*}
     */
    read: function (req, res) {
        if (req.param("id")) {
            Homework.findOne({
                id: sanitizer.escape(req.param("id"))
            }).populate("owner").exec(function(err,hw){
                if(err){
                    return ErrorService.sendError(404, err, req, res);
                }
                else{
                    if(hw) {
                        Comment.find({
                            homework: hw.id
                        }).populate('owner').exec(function(err,comments){
                            if (err)
                                return ErrorService.sendError(404, err, req, res);
                            res.json({
                                homework: hw,
                                comments: comments
                            });
                        });
                    }
                    else {
                        return ErrorService.sendError(500, err, req, res);
                    }
                }
            });
        }
        else
            return ErrorService.sendError(412, 'Missing parameters', req, res);
    },


    /** UPDATE HOMEWORK **/
    /**
     * Function to update a homework
     * @param owner
     * @param id
     * @param name
     * @param content
     * @param tags
     * @param res
     */
    update: function(req,res){
        if(req.token.id && req.param("id") && req.param("name") && req.param("content") && req.param("tags")){
            Homework.findOne({
                id: sanitizer.escape(req.param("id"))
            }).populate('owner').exec(function(err,homework){
               if(err){
                   ErrorService.sendError(404, err, req, res);
               }
               // check if the user updating the homework is the one who posted it
               else if(homework.owner.id == sanitizer.escape(req.token.id)){
                   homework.name = sanitizer.escape(req.param("name"));
                   homework.content = req.param("content");
                   homework.tags = req.param("tags");
                   homework.save(function(err) {
                       if (err) {
                           return ErrorService.sendError(500, err, req, res);
                       }
                       res.json(homework);
                   });
               }
            });
        }
    }

};

