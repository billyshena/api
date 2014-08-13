/**
 * Created by relbachiri on 01/07/14.
 */
var sanitizer = require('sanitizer');

module.exports = {
    create: function(req,res){
        if(req.token.id && req.param("content")){
            Post.create({
                owner: req.token.id,
                content: req.param("content")
            }).exec(function(err,post){
                if(err){
                    return ErrorService.sendError(404, err, req, res);
                }
                if(!post){
                    return ErrorService.sendError(500, 'Post object not found', req, res);
                }
                post.owner = {
                    id: req.token.id,
                    firstName: req.token.firstName ,
                    lastName: req.token.lastName,
                    avatar: req.token.avatar };

                post.comments = [];
                sails.sockets.blast('newPost',post);
                return res.json(200);
            });
        }
        else
            return ErrorService.sendError(412, 'Missing parameters', req, res);
    }
};
