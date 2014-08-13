/**
 * Created by shen on 19/06/14.
 */
/**
 * Created by shen on 17/02/14.
 */
var connectedClients = {};
var async = require('async');
module.exports = {


    /** When a new user is connected **/
    onUserConnect : function(req,res){
        if(req.token && req.token.id > 0){
            var socketId = sails.sockets.id(req.socket);
            connectedClients[req.token.id] = socketId;
            sails.sockets.blast('newUser',req.token);
        }
    },

    /** WHENEVER THE USER LEAVES / CLOSES HIS TAB **/
    onDisconnect : function(session,socket){
        var socketId = sails.sockets.id(socket);
        // Remove the associated client from his socket request id
        for(var key in connectedClients){
            if(connectedClients[key] === socketId){
                delete connectedClients[key];
                sails.sockets.blast('onDisconnect',key);
                break;
            }
        }
    },

    // return all the connected clients
    getConnectedClients: function(req,res){
        var connectedKeys = Object.keys(connectedClients);
        var clients = [];
        async.forEach(connectedKeys, function(key,callback){
            User.findOne({
                id: key
            }).exec(function(err,user){
                clients.push(user);
                callback();
            });
        },function(err){
            res.json(clients);
        });
    },

    // return the number of connected clients
    getNumberConnectedClients: function(req,res){
        var connectedKeys = Object.keys(connectedClients);
        return res.json({
            nb: connectedKeys.length
        });
    },


    // function to delete the user from the connectedClients array
    leave: function(id){
        delete connectedClients[id];
    },


    // send a notification to the appropriate client
    sendNotificationToUser: function(notification,message){
        if(connectedClients.hasOwnProperty(notification.to) && connectedClients[notification.to] !== undefined && connectedClients[notification.to] !== ''){
            var receiver =  connectedClients[notification.to];
            sails.sockets.emit(receiver,message,notification);
        }
        else{
            console.log("User's socket is no longer available");
        }
    },

    // Send a private message to the appropriate client
    sendMessageToUser: function(receiverId,message){
        if(connectedClients.hasOwnProperty(receiverId) && connectedClients[receiverId] !== undefined){
            var receiver = connectedClients[receiverId];
            sails.sockets.emit(receiver,'privatemessage',message);
        }

    },

    /** UPDATE THE CURRENT USER SOCKET ID **/
    updateUserSocketId: function(token,req){
        if(req.isSocket){
            User.update({
                id: token.id
            },{socketId: sails.sockets.id(req.socket) }).exec(function(err,user){
                if(err){
                    return console.log(err);
                }
                else{
                    if(user[0] && user[0].id > 0) {
                        connectedClients[user[0].id] = user[0].socketId;
                    }
                }
            });
        }
    }


};