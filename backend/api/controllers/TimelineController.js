/**
 * TimelineController.js
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */
var async = require('async');
var sanitizer = require('sanitizer');

module.exports = {

    index: function (req, res) {
        var homeworks = 0;
        var posts = 0;
        var files = 0;
        var courses = 0;

        /** Get the number of items on each section **/
        if(req.param("homeworks") && req.param("posts") && req.param("files") && req.param("courses")){
            homeworks = parseInt(sanitizer.escape(req.param("homeworks")));
            posts = parseInt(sanitizer.escape(req.param("posts")));
            files = parseInt(sanitizer.escape(req.param("files")));
            courses = parseInt(sanitizer.escape(req.param("courses")));
        }

        // TODO: Check if everything is handled (callbacks + errors)
        /** Run in parallel the following Functions **/
        async.parallel(
            {
                /** GET THE LATEST HOMEWORKS **/
                homeworks: function (callback) {
                    Homework.find()
                        .sort('createdAt DESC')
                        .skip(homeworks)
                        .limit(5)
                        .populate('owner')
                        .populate('comments')
                        .exec(function (err, homeworks) {
                            loadCommentOwner(homeworks,callback,"devoir");
                        });
                },

                /** GET THE LATEST POSTS **/
                posts: function (callback) {
                    Post.find()
                        .sort('createdAt DESC')
                        .skip(posts)
                        .limit(5)
                        .populate('owner')
                        .populate('comments')
                        .exec(function (err, posts) {
                            loadCommentOwner(posts,callback,"poste");
                        });
                },
                /** GET THE LATEST SHARED FILES **/
                file: function (callback) {
                    File
                        .find({
                            permission: 'public'
                        })
                        .sort('updatedAt DESC')
                        .skip(files)
                        .limit(5)
                        .populate('owner')
                        .populate('comments')
                        .exec(function (err, files) {
                            loadCommentOwner(files,callback,"fichier");
                        });
                },

                /** GET THE LATEST COURSES **/
                courses: function (callback) {
                    Course
                        .find()
                        .sort('createdAt DESC')
                        .skip(courses)
                        .limit(5)
                        .populate('owner')
                        .populate('comments')
                        .exec(function (err, courses) {
                            loadCommentOwner(courses,callback,"cours");
                        });
                }
            },

            /**
             * Callback that is called after all parallel jobs are done or some error has occurred
             * within processing those.
             *
             * @param   {null|string}   error   Possible error
             **/
                function (error, data) {
                if (error) {
                    return ErrorService.sendError(500, error, req, res);
                    // An error occurred
                } else {
                    return res.json(data);
                }
            });


        /** Results is an array of objects and each object has an array of Comments **/
        function loadCommentOwner(results,callback,section){
            async.each(
                results,
                function getResult(result,callback1){
                    result.section = section;
                    async.each(
                        result.comments,
                        function(comment,callback2){
                            User
                                .findOne({ id: comment.owner })
                                .exec(function(err,user){
                                    if(err){
                                        callback2(err);
                                    }
                                    if(!user){
                                        callback2(err);
                                    }
                                    comment.owner = user;
                                    callback2();
                                });
                        },
                        /** When we finished loop on each Comment of the Result object **/
                        function(err){
                            if(err){
                                callback1(err);
                            }
                            callback1();
                        }
                    );
                },
                function(err){
                    /** Call the main function callback when everything is done **/
                    callback(err,results);
                }
            );
        }

    }
};
