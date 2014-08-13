/**
 * ResultController
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

var validator = require('validator');
var sanitizer = require('sanitizer');
var mailer = require('nodemailer');
var fs = require('fs');


module.exports = {

    /**
     *
     * @param owner
     * @param res
     * @returns {*}
     */
    student: function (req, res) {

        if(req.token && req.token.id > 0) {
            User.findOne({
                id: req.token.id
            }).populate('teams').exec(function(err, user) {

                var data = new Array();

                function loadSubjects(i, callback) {
                    if (i < user.teams.length) {

                        // Finding all subjects for the team
                        Team.findOne({
                            id: user.teams[i].id
                        }).populate('subjects').populate('users').exec(function(err, team) {
                            if(err) {
                                return ErrorService.sendError(404, err, req, res);
                            }

                            // Loading exams and marks foreach subjects
                            function loadExams(j, callback2) {
                                if(j < team.subjects.length) {
                                     Exam.find({
                                         class: team.id,
                                         subject: team.subjects[j].id
                                     }).populate('marks').populate('teacher').exec(function(err, exams) {
                                         if(err){
                                             return ErrorService.sendError(404, err, req, res);
                                         }
                                         data.push(new Array(team.subjects[j], exams, team.users));
                                         loadExams(j + 1, callback2);
                                     });

                                }
                                else {
                                    callback2();
                                }
                            }

                            loadExams(0, function() {
                                loadSubjects(i + 1, callback);
                            });

                        });
                    }
                    else {
                        callback();
                    }
                }
                loadSubjects(0, function () {
                    return res.json(data);
                });
            });
        }
        else {
            return ErrorService.sendError(412, 'Missing parameters', req, res);
        }

    },


    /**
     * Action blueprints:
     *    `/result/class`
     */
    class: function (req, res) {
        /* Teacher */
        if (req.param('id') && req.param('subject') && req.param('teacher')) {
            Exam.find({
                class: req.param('id'),
                subject: req.param('subject'),
                teacher: req.param('teacher')
            }).exec(function (err, exams) {

                Team.findOne({
                    id: req.param('id')
                }).populate('users').exec(function (err, team) {

                    if (err) {
                        return console.log(err);
                    }

                    /* Putting only the id in a new array */
                    var examsId = Array();
                    for (var k = 0; k < exams.length; k++) {
                        examsId.push(exams[k].id.toString());
                    }

                    var users = [];

                    function process(i, callback) {
                        if (i < team.users.length) {
                            Mark.find({
                                student: team.users[i].id,
                                exam: examsId
                            }).sort('exam ASC').exec(function (err, marks) {
                                if (err) {
                                    return console.log(err);
                                }
                                team.users[i].marks = marks;
                                users.push(team.users[i]);
                                process(i + 1, callback);
                            });
                        } else {
                            callback()
                        }
                    }

                    process(0, function () {
                        console.log(users);
                        return res.json({
                            students: users,
                            exams: exams
                        });
                    });
                });
            });
        }
        else {
            return res.json({
                error: 'Missing parameters'
            })
        }
    },

    /**
     *
     * @param id
     * @param subject
     * @param teacher
     * @param res
     * @returns {*}
     */
    send: function (req, res) {
        /* Teacher */
        if (req.param('id') && req.param('subject') && req.param('teacher')) {
            Exam.find({
                class: req.param('id'),
                subject: req.param('subject'),
                teacher: req.param('teacher')
            }).populate('subject').populate('teacher').exec(function (err, exams) {

                Team.findOne({
                    id: req.param('id')
                }).populate('users').exec(function (err, team) {

                    if (err) {
                        return ErrorService.sendError(404, err, req, res);
                    }

                    /* Putting only the id in a new array */
                    var examsId = Array();
                    for (var k = 0; k < exams.length; k++) {
                        examsId.push(exams[k].id.toString());
                    }

                    var users = [];

                    function process(i, callback) {
                        if (i < team.users.length) {
                            Mark.find({
                                student: team.users[i].id,
                                exam: examsId
                            }).sort('exam ASC').exec(function (err, marks) {
                                if (err) {
                                    return ErrorService.sendError(404, err, req, res);
                                }
                                team.users[i].marks = marks;
                                users.push(team.users[i]);
                                process(i + 1, callback);
                            });
                        } else {
                            callback()
                        }
                    }

                    process(0, function () {


                        var filename = team.name + '_' + exams[0].teacher.lastName + '.xls';


                        // Creating the stream content
                        var content = "Nom\tPrénom";
                        for(var j=0; j < exams.length; j++) {
                            content += '\t' + exams[j].name;
                        }
                        content += '\n';
                        for(var i=0; i < users.length; i++) {
                            content += users[i].lastName + '\t' + users[i].firstName;

                            var k = 0;
                            var l = 0;
                            while(k < exams.length) {
                                if(users[i].marks[l] && users[i].marks[l].exam == exams[k].id) {
                                    content += '\t' + users[i].marks[l].value;
                                    l++;
                                }
                                else {
                                    content += '\t';
                                }
                                k++;
                            }
                            content += '\n';
                        }

                        // Sending email
                        mailService.send(
                            {
                                sender: 'contact.educloud@gmail.com',
                                to: 'guiiks@hotmail.fr',
                                subject: 'Notes de Mr. ' + exams[0].teacher.lastName + ' pour ' + team.name,
                                body: 'Bonjour,\n\n' +
                                    'Mr. ' + exams[0].teacher.lastName + ' vient de saisir les notes de ' + exams[0].subject.name +
                                    ' pour la classe de ' + team.name + ' sur EduCloud. Vous les trouverez en pièce jointe.\n\n' +
                                    'Bonne journée,\nL\'équipe EduCloud'
                                ,
                                attachments: [
                                    {'filename': filename, 'contents': content}
                                ]
                            }, function (error, success) {
                                if(error) {
                                    return ErrorService.sendError(500, error, req, res);
                                }
                                return res.json('ok');
                            }
                        );

                    });
                });
            });
        }
        else {
            return ErrorService.sendError(412, 'Missing parameters', req, res);
        }
    },


    /**
     * Overrides for the settings in `config/controllers.js`
     * (specific to ResultController)
     */
    _config: {}


};