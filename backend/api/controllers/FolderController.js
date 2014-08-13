/**
 * FolderController
 *
 * @description :: Server-side logic for managing folders
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

var async = require('async');
var sanitizer = require('sanitizer');
module.exports = {


    /**
     *
     * @param owner
     * @param parent
     * @param res
     * @returns {*}
     */
    load: function (req, res) {

        if(req.token && req.token.id > 0) {
            var parent = -1;

            // If a folder id has been passed, we load it
            if (req.param('parent')) {
                parent = parseInt(req.param('parent'));
            }

            async.parallel(
                {
                    // Fetch Folders
                    folders: function(callback) {
                        Folder
                            .find({ owner: req.token.id, parent: parent })
                            .exec(function(err, folders) {
                                callback(err, folders);
                            });
                    },

                    // Fetch Files
                    files: function(callback) {
                        File
                            .find({owner: req.token.id, folder: parent, status: 'ok'})
                            .exec(function(err, files) {
                                callback(err, files)
                            });
                    }

                },

                /**
                 * Callback that is called after all parallel jobs are done or some error has occurred
                 * within processing those.
                 *
                 * @param   {null|string}   error   Possible error
                 **/
                    function(error, data) {
                    if (error) {
                        return ErrorService.sendError(404, error, req, res);
                        // An error occurred
                    } else {
                        return res.json(data);
                    }
                });
        }
        else {
            return ErrorService.sendError(400, 'Missing parameters', req, res);
        }
    }

};

