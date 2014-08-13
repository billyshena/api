/**
 * QuizController
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


module.exports = {

    /**
     *
     * @param param
     * @param res
     * @returns {*}
     */
    update: function(req,res){

        if(req.param('quiz') && req.param('quiz').id) {

            var quizUpdated = req.param('quiz');

            Quiz.findOne({
                id: quizUpdated.id
            }).populate('questions').exec(function (err, quiz) {

                if (err || !quiz) {
                    return console.log('Error');

                }

                quiz.name = sanitizer.escape(quizUpdated.name);
                quiz.timer = parseInt(quizUpdated.timer);

                /** Removing all the old question object */
                async.each(
                    quiz.questions,
                    function(question, callback) {
                        Question.destroy({
                            id: question.id
                        }).exec(function(err,result){
                            if(err){
                                return ErrorService.sendError(404, err, req, res);
                            }
                            console.log('deleting association ' + question.id);
                            quiz.questions.remove(question.id); // Remove the association
                        });
                        callback();
                    },
                    function(err){
                        if(err){
                            return ErrorService.sendError(404, err, req, res);
                        }
                        /* Adding all the new questions */
                        async.each(
                            quizUpdated.questions,
                            function(question, callback) {
                                // Creating the answer array and the matrix
                                var answers = new Array();
                                var matrix = new Array();

                                // Putting all the answers in the matrix
                                for (var j = 0; j < question.answers.length; j++) {
                                    answers.push(question.answers[j].value);
                                    matrix.push(question.answers[j].correct);
                                }

                                Question.create({
                                    statement: question.statement,
                                    points: parseInt(question.points),
                                    matrix: matrix,
                                    answers: answers,
                                    difficulty: question.difficulty,
                                    quiz: quiz.id
                                }).exec(function (err, quest) {

                                    // If error
                                    if (err) {
                                        return ErrorService.sendError(404, err, req, res);
                                    }
                                    // The question was created successfully!
                                    else {
                                        quiz.questions.add(quest.id);
                                        callback();
                                    }
                                });
                            },
                            /** WHEN EVERYTHING IS DONE **/
                                function(err){
                                if(err){
                                    return ErrorService.sendError(404, err, req, res);
                                }
                                console.log(quiz);
                                quiz.save(function(err) {
                                    return ErrorService.sendError(404, err, req, res);
                                });
                                return res.json('ok');
                            });
                    });
            });

        }
        else
        {
            return ErrorService.sendError(412, 'Missing parameters', req, res);
        }

    },


    /**
     *
     * @param quiz
     * @param res
     * @returns {*}
     */
    create: function (req, res) {
        if (req.param('quiz')) {

            var quiz = req.param('quiz');

            console.log(quiz.course);

            // Creating the quiz
            Quiz.create({
                name: sanitizer.escape(quiz.name),
                timer: parseInt(quiz.timer),
                course: quiz.course,
                owner: quiz.owner
            }).exec(function (err, q) {

                if (err) {
                    return ErrorService.sendError(500, err, req, res);
                }
                else {

                    function addQuestion(i, callback) {

                        if (i < quiz.questions.length) {

                            // Creating the answer array and the matrix
                            var answers = new Array();
                            var matrix = new Array();

                            // Putting all the answers in the matrix
                            for (var j = 0; j < quiz.questions[i].answers.length; j++) {
                                answers.push(quiz.questions[i].answers[j].value);
                                matrix.push(quiz.questions[i].answers[j].correct);
                            }

                            console.log(answers);
                            console.log(matrix);

                            Question.create({
                                statement: quiz.questions[i].statement,
                                points: parseInt(quiz.questions[i].points),
                                matrix: matrix,
                                answers: answers,
                                difficulty: quiz.questions[i].difficulty,
                                quiz: q.id
                            }).exec(function (err, question) {
                                if (err) {
                                    return ErrorService.sendError(404, err, req, res);
                                }
                                // The question was created successfully!
                                else {
                                    q.questions.add(question.id);
                                    q.save(function (err) {
                                        if (err) {
                                            return ErrorService.sendError(404, err, req, res);
                                        }
                                        else {
                                            console.log('quiz saved');
                                            addQuestion(i + 1, callback);
                                        }
                                    });
                                }
                            });
                        }
                        else {
                            callback();
                        }
                    };

                    addQuestion(0, function(){
                        return console.log('quiz created');
                    });

                }
            });
        }
        else {
            return ErrorService.sendError(412, 'Missing arguments', req, res);
        }
    },


    /**
     * /quiz/view
     * @param id
     * @param res
     */
    view: function (req, res) {
        if(req.param('id')) {
            Quiz.findOne({
                id: req.param('id')
            }).populate('questions').populate('owner').exec(function(err, quiz) {
                if (err)
                    return ErrorService.sendError(404, err, req, res);
                QuizMark.find({
                    quiz: quiz.id
                }).populate('user').exec(function(err, marks) {
                    if (err)
                        return ErrorService.sendError(404, err, req, res);
                    res.view({
                        marks: marks,
                        quiz: quiz
                    });
                });
            });
        }
        else {
            res.redirect('/');
        }
    },


    /**
     *
     * @param id
     * @param res
     * @returns {*}
     */
    excel: function (req, res) {
        if(req.param('id')) {
            Quiz.findOne({
                id: req.param('id')
            }).populate('questions').populate('owner').exec(function(err, quiz) {
                if (err)
                    return ErrorService.sendError(404, err, req, res);
                QuizMark.find({
                    quiz: quiz.id
                }).populate('user').exec(function(err, marks) {
                    if (err)
                        return ErrorService.sendError(404, err, req, res);
                    /* Then, creating the excel file */

                    var fs = require('fs');

                    res.setHeader('Content-disposition', 'attachment; filename=' + sanitizer.escape(quiz.name).replace(',', '_') + '.xls');
                    res.setHeader('Content-type', 'application/vnd.ms-excel');

                    var header="Nom Prénom"+"\t"+"Note"+"\n";
                    res.write(header);

                    for(var i=0; i<marks.length; i++) {
                        res.write(marks[i].user.lastname + ' ' + marks[i].user.firstname + '\t' + marks[i].value + '\n');
                    }

                    res.end();
                });
            });
        }
        else {
            return ErrorService.sendError(412, 'Missing parameters', req, res);
        }
    },


    /**
     *
     * @param id
     * @param res
     * @returns {*}
     */
    csv: function (req, res) {
        if(req.param('id')) {
            Quiz.findOne({
                id: req.param('id')
            }).populate('questions').populate('owner').exec(function(err, quiz) {
                if (err)
                    return ErrorService.sendError(404, err, req, res);
                QuizMark.find({
                    quiz: quiz.id
                }).populate('user').exec(function(err, marks) {
                    if (err)
                        return ErrorService.sendError(404, err, req, res);
                    /* Then, creating the excel file */

                    var fs = require('fs');

                    res.setHeader('Content-disposition', 'attachment; filename=' + sanitizer.escape(quiz.name).replace(',', '_') + '.csv');
                    res.setHeader('Content-type', 'text/csv');

                    var header="Nom Prénom"+","+"Note"+"\n";
                    res.write(header);

                    for(var i=0; i<marks.length; i++) {
                        res.write(marks[i].user.lastname + ' ' + marks[i].user.firstname + ',' + marks[i].value + '\n');
                    }

                    res.end();
                });
            });
        }
        else {
            return ErrorService.sendError(412, 'Missing parameters', req, res);
        }
    },


    /**
     *
     * @param id
     * @param matrix
     * @param res
     * @returns {*}
     */
    validate: function (req, res) {
        if(req.param('id') && req.param('matrix')) {

            var answers = JSON.parse(req.param('matrix'));

            console.log(answers[0][0]);

            function compareMatrix(array1, array2) {

                console.log(array1.length + ' ' + array2.length);

                // if the other array is a falsy value, return
                if (!array1 || !array2)
                    return false;

                // compare lengths - can save a lot of time
                if (array1.length != array2.length)
                    return false;

                for (var i = 0, l=array1.length; i < l; i++) {
                    // Check if we have nested arrays
                    if (array1[i] instanceof Array && array2[i] instanceof Array) {
                        // recurse into the nested arrays
                        if (!compareMatrix(array1, array2))
                            return false;
                    }
                    else if (array1[i] != array2[i]) {
                        // Warning - two different object instances will never be equal: {x:20} != {x:20}
                        return false;
                    }
                }
                return true;
            }

            var points = 0;
            var total = 0;

            Quiz.findOne({
                id: req.param('id')
            }).populate('questions').populate('owner').exec(function(err, quiz) {
                if (err)
                    return ErrorService.sendError(404, err, req, res);
                QuizMark.findOne({
                    quiz: quiz.id,
                    user: req.token.id
                }).exec(function(err, mark) {
                    if(mark) {
                       return res.json(400, {
                            error: 'Vous avez déjà fait le quiz.'
                        });
                    }
                    else {
                        /* Correcting with the matrix */
                        for(var i=0; i<quiz.questions.length; i++) {
                            if(answers[i]) {
                                /* If all the answers are correct */
                                if(compareMatrix(answers[i], JSON.parse(quiz.questions[i].matrix))) {
                                    console.log('good answer');
                                    points += quiz.questions[i].points;
                                }
                                else {
                                    console.log('bad');
                                }
                                total += quiz.questions[i].points;
                            }
                        }

                        /* Looking if the user already did it */
                        QuizMark.create({
                            quiz: quiz.id,
                            user: req.token.id,
                            value: points
                        }).exec(function(err, mark) {
                            if (err)
                                return ErrorService.sendError(404, err, req, res);
                            return res.json({
                                points: points,
                                total: total
                            });
                        });
                    }
                });
            });
        }
        else {
            return ErrorService.sendError(412, 'Missing parameters', req, res);
        }
    },


    /**
     * Overrides for the settings in `config/controllers.js`
     * (specific to QuizController)
     */
    _config: {}


};