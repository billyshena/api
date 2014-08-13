/**
 * TimelineCommentController
 *
 * @description :: Server-side logic for managing Timelinecomments
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

    /**
     * Create a comment
     * @param owner
     * @param content
     * @param file
     * @param course
     * @param post
     * @param res
     */
    create: function (req, res) {
        if (req.token.id && req.param("content") && (req.param("file") || req.param("course") || req.param("post"))){
            TimelineComment.create({
                owner: req.token.id,
                content: req.param("content"),
                file: req.param("file"),
                post: req.param("post"),
                course: req.param("course")
            }).exec(function (err, result) {
                if (err) {
                    return ErrorService.sendError(404, err, req, res);
                }
                if(!result){
                    return ErrorService.sendError(500, 'TimelineComment object no found', req, res);
                }
                /** Set the Owner object to the comment **/
                result.owner = {firstName: req.token.firstName , lastName: req.token.lastName, avatar: req.token.avatar };
                console.log('creating coment id ' + result.id);
                sails.sockets.blast('comment', result );
                return res.json(200);
            });
        }
    }
};

