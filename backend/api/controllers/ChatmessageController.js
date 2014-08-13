/**
 * ChatmessageController
 *
 * @description :: Server-side logic for managing chatmessages
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */
var sanitizer = require('sanitizer');
module.exports = {

    create: function(req,res){
        if(req.token.id && req.param("to") && req.param("content")) {
            Chatmessage.create({
                to: req.param("to"),
                from: req.token.id,
                content: req.param("content")
            }).exec(function(err,message){
                if(err){
                    return ErrorService.sendError(500,err,req,res);
                }
                if(!message){
                    return ErrorService.sendError(400,"Aucun Chatmessage trouvé", req, res);
                }
                message.from = {
                    id: req.token.id,
                    firstName: req.token.firstName ,
                    lastName: req.token.lastName,
                    avatar: req.token.avatar
                };
                userService.sendMessageToUser(message.to, message);
                return res.json(message);
            });
        }
    }
};

