/**
 * Created by guillaume on 04/07/2014.
 */

/**
 * MarkController
 *
 * @module      :: Controller
 * @description    :: A set of functions called `actions`.
 *
 *                 Actions contain code telling Sails how to respond to a certain type of request.
 *                 (i.e. do stuff, then send some JSON, show an HTML page, or redirect to another URL)
 *
 *                 You can configure the blueprint URLs which trigger these actions (`config/controllers.js`)
 *                 and/or override them with custom routes (`config/routes.js`)
 *
 *                 NOTE: The code you write here supports both HTTP and Socket.io automatically.
 *
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */

var sanitizer = require('sanitizer');

module.exports = {

    /**
     *
     * @param student
     * @param exam
     * @param mark
     * @param res
     */
    create: function (req, res) {

        if (req.param('student') && req.param('exam') && req.param('mark')) {

            // First we check if a mark already exists
            Mark.findOne({
                student: req.param('student'),
                exam: req.param('exam')
            }).exec(function (err, mark) {
                if (err) {
                    return ErrorService.sendError(404, err, req, res);
                }
                // If exists, we update it
                if (mark) {
                    console.log(mark);
                    mark.value = sanitizer.escape(req.param('mark'));
                    mark.save(function (err) {
                        if (err)
                            return ErrorService.sendError(404, err, req, res);
                        console.log(err);
                        console.log("mark updated" + mark);
                    });
                    res.json(req.param('mark'));
                }
                else {
                    Mark.create({
                        student: req.param('student'),
                        exam: req.param('exam'),
                        value: req.param('mark')
                    }).exec(function (err, mark) {
                        if (err) {
                            return ErrorService.sendError(404, err, req, res);
                        }
                        else {
                            console.log('mark created ', mark);
                            res.json(req.param('mark'));
                        }
                    });
                }
            });
        }
        else {
            return ErrorService.sendError(412, 'Missing parameters', req, res);
        }
    }

};