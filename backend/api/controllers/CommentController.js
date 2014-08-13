/**
 * CommentController
 *
 * @description :: Server-side logic for managing comments
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

    /**
     * Override default create function of the blueprint API
     * @param req
     * @param res
     */
    create: function(req, res){
        if(req.token.id && req.param("content") && req.param("homework")){
            Comment.create({
                owner: req.token.id,
                content: req.param("content"),
                homework: req.param("homework")
            }).exec(function(err, comment){
                if(err) {
                    return ErrorService.sendError(500, err, req, res);
                }
                if(!comment){
                    return ErrorService.sendError(400,"Objet commentaire non trouvé", req, res);
                }
                comment.owner = {firstName: req.token.firstName, lastName: req.token.lastName, avatar: req.token.avatar};
                /** BROADCAST COMMENT EVENT TO .SUBSCRIBE('COMMENT') **/
                sails.sockets.blast('comment',{comment: comment });
                return res.json(200);
            });
        }
        else{
            return ErrorService.sendError(412,'Missing parameters',req,res);
        }
    }
	
};

