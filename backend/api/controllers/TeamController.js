/**
 * TeamController.js 
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */
var async = require('async');
var sanitizer = require('sanitizer');

module.exports = {

    /** FUNCTION TO CREATE A TEAM **/
    /**
     * Function to create a team
     * @param owner
     * @param students
     * @param teachers
     * @param subjects
     * @param name
     * @param type
     * @param res
     */
    create: function (req, res) {
        if (req.token.id && req.param("students") && req.param("teachers") && req.param("subjects") && req.param("name") && req.param("type")) {

            var students = req.param("students");
            var teachers = req.param("teachers");
            var subjects = req.param("subjects");
            console.log(teachers);

            Team.create({
                owner: req.token.id,
                name: req.param("name"),
                type: req.param("type"),
                parent: req.param("parent") || 0
            }).exec(function (err, newTeam) {
                if (err) {
                    return ErrorService.sendError(404, err, req, res);
                }
                else {
                    // TODO: Remove the findOne
                    Team.findOne({
                        id: newTeam.id
                    }).exec(function (err, team) {
                        if (err) {
                            return ErrorService.sendError(404, err, req, res);
                        }
                        else {
                            async.parallel(
                                {
                                    // add each student to the current team
                                    addStudents: function (callback) {
                                        async.each(students, function (student, callback) {
                                            team.users.add(student);
                                        });
                                        callback();
                                    },

                                    // add each teacher to the current team
                                    addTeachers: function (callback) {
                                        async.each(teachers, function (teacher, callback) {
                                            console.log('adding teacher = ' + teacher);
                                            team.teachers.add(teacher);
                                        });
                                        callback();
                                    },

                                    // add each subject to the current team
                                    addSubjects: function (callback) {
                                        async.each(subjects, function(subject, callback) {
                                            team.subjects.add(subject);
                                        });
                                        callback();
                                    }
                                },

                                /**
                                 * Callback that is called after all parallel jobs are done or some error has occurred
                                 * within processing those.
                                 *
                                 * @param   {null|string}   error   Possible error
                                 **/

                                 function (error) {
                                    if (error) {
                                        return ErrorService.sendError(404, error, req, res);
                                    } else {
                                        team.save(function (err) {
                                            if (err) {
                                                return ErrorService.sendError(404, err, req, res);
                                            }
                                            else {
                                                console.log(team);

                                                // If a parent has been passed, we need to add the new team
                                                if(req.param('parent')) {
                                                    Team.findOne({
                                                        id: req.param('parent')
                                                    }).exec(function (err, parentTeam) {
                                                        if (err) {
                                                            return ErrorService.sendError(404, err, req, res);
                                                        }
                                                        else {
                                                            parentTeam.teams.add(team.id);
                                                            parentTeam.save(function (err) {
                                                                if (err) {
                                                                    return ErrorService.sendError(500, err, req, res);
                                                                }
                                                                else {
                                                                    return res.json({
                                                                        message: 'success'
                                                                    });
                                                                }
                                                            });
                                                        }
                                                    });
                                                }
                                                else {
                                                    return res.json({
                                                        message: 'success'
                                                    });
                                                }
                                            }
                                        });
                                    }
                            });
                        }
                    });
                }
            });
        }
    },




    /**
     * Function to get all teams (classes + groups)
     * @param req
     * @param res
     */
    getTeams: function(req,res){
        var data = new Array();
        Team
            .find({
                parent: 0
            })
            .populate('users')
            .populate('teachers')
            .populate('subjects')
            .populate('teams')
            .exec(function(err,teams){
               if(err){
                   return ErrorService.sendError(404, err, req, res);
               }
               else{
                   function loadGroups(i, callback) {
                       if(i < teams.length) {
                           Team
                               .find({
                                    parent: teams[i].id
                                })
                               .populate('users')
                               .populate('teachers')
                               .exec(function(err, groups) {
                                   if(err) {
                                       return ErrorService.sendError(404, err, req, res);
                                   }

                                   teams[i].groups = groups;
                                   data.push(teams[i]);

                                   loadGroups(i+1, callback);
                               })
                       }
                       else {
                           callback();
                       }
                   }

                   loadGroups(0, function() {
                       return res.json(data);
                   });
               }
        });
    }

};
