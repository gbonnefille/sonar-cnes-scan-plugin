window.registerExtension('cnesscan/analysis', function (options) {
    // let's create a flag telling if the page is still displayed
    var isDisplayedAnalysis = true;

    /**
     * Log information in the bottom text area
     * @param string Text to log
     */
    var log = function (string) {
        // get the logging element
        var logging = document.querySelector('#logging');
        // append text to log
        logging.innerHTML = logging.innerHTML + "\n" + string;
        // scroll to bottom
        logging.scrollTop = logging.scrollHeight;
    };

    /**
     * Verify that the permissions are good.
     * @returns {boolean} true if all is good
     */
    var checkPermissions = function () {
        // get permissions of the current user
        var perm = options.currentUser.permissions.global;
        // check that scan, quality gate admin and provisioning rights are in the permission array
        return options.currentUser.isLoggedIn && perm.indexOf("gateadmin")!==-1 && perm.indexOf("scan")!==-1 && perm.indexOf("provisioning")!==-1;
    };

    /**
     * Verify that the fields are correct.
     * @returns {boolean} true if all is good
     */
    var checkForm = function () {
        // check the field key
        // get it
        var key = document.forms["analyze-form"]["key"].value;
        // check if void
        if (key === "") {
            // log error
            log("Key must be filled out.");
            // abort the process
            return false;
        }
        // check the field name (project)
        // get it
        var name = document.forms["analyze-form"]["name"].value;
        // check if void
        if (name === "") {
            log("Name must be filled out.");
            // abort the process
            return false;
        }
        // check the field folder (project)
        // get it
        var folder = document.forms["analyze-form"]["folder"].value;
        // check if void
        if (folder === "") {
            log("Workspace must be filled out.");
            // abort the process
            return false;
        }
        // check the field sources (project)
        // get it
        var folder = document.forms["analyze-form"]["sources"].value;
        // check if void
        if (folder === "") {
            log("Sources must be filled out.");
            // abort the process
            return false;
        }
        // check the field spp (sonar-project.properties)
        // get it
        var spp = document.forms["analyze-form"]["spp"].value;
        // check if void
        if (spp === "") {
            log("sonar-project.properties must be filled out.");
            // abort the process
            return false;
        // check if it contains <<TO REPLACE>>
        } else if(spp.indexOf("<<TO REPLACE>>")!==-1) {
            log("sonar-project.properties was not correctly filled out. Replace all '<<TO REPLACE>>' fields.");
            // abort the process
            return false;
        // check if the user try to set project key
        } else if(spp.indexOf("sonar.projectKey")!==-1) {
            log("Please do not use 'sonar.projectKey' property.");
            // abort the process
            return false;
        // check if the user try to set project name
        } else if(spp.indexOf("sonar.projectName")!==-1) {
            log("Please do not use 'sonar.projectName' property.");
            // abort the process
            return false;
        // check if the user try to set project sources
        } else if(spp.indexOf("sonar.sources")!==-1) {
            log("Please do not use 'sonar.sources' property.");
            // abort the process
            return false;
        // check if the user try to set project version
        } else if(spp.indexOf("sonar.projectVersion")!==-1) {
            log("Please do not use 'sonar.projectVersion' property.");
            // abort the process
            return false;
        // check if the user try to set project description
        } else if(spp.indexOf("sonar.projectDescription")!==-1) {
            log("Please do not use 'sonar.projectDescription' property.");
            // abort the process
            return false;
        }

        return true;
    };

    /**
     * Clear log information in text area
     */
    var clearLog = function () {
        // get the logging element
        var logging = document.querySelector('#logging');
        // set initial text to log
        logging.innerHTML = "## Logging console ##";
    };

    /**
     *  Lock or unlock the form
     *  @param isEnabled true to unlock, false to lock the form
     */
    var setEnabled = function (isEnabled) {
        // retrieve the form
        var form = document.getElementById("analyze-form");
        // get all the components of the form
        var elements = form.elements;
        // change all components readOnly field to (un)lock them
        for (var i = 0, len = elements.length; i < len; ++i) {
            elements[i].readOnly = !isEnabled;
            elements[i].disabled = !isEnabled;
        }

        if(isEnabled) {
            // hide loading when button are enabled
            $('#loading').hide();
        } else {
            // show loading otherwise
            $('#loading').show();
        }
    };

    /**
     * Generate the report
     * @param key
     * @param name
     * @param qualitygate
     * @param author
     */
    var produceReport = function (key, name, qualitygate, author) {
        // http GET request to the cnes web service
        window.SonarRequest.getJSON(
            '/api/cnes/report',
            { key: key, name: name, qualitygate: qualitygate, author: author }
        ).then(function (response) {
            // on success log generation
            log("[INFO] Project report generation response: \n" + response.logs);
            log("############################################################\n\tAnalysis finished with success!\n############################################################\n");
            // unlock form
            setEnabled(true);
        }).catch(function (error) {
            // log error
            log("[ERROR] Project report generation failed.");
            // unlock form
            setEnabled(true);
        });
    };

    /**
     * Create a project and set the quality gate and profiles of the project
     * @param projectKey Key of the project
     * @param name
     * @param folder
     * @param qualityGate value for the quality gate
     * @param qualityProfile value for the quality profile
     * @param spp
     * @param author
     * @param version
     * @param description
     * @param sources
     * @param callback
     */
    var createProject = function (  projectKey, name, folder, qualityGate, qualityProfile, spp, author,
                                    version, description, sources, callback) {

        // check if the quality gate field is filled out
        qualityGate = qualityGate === "" ? "CNES" : qualityGate;

        // Request to create a project with quality parameters
        window.SonarRequest.getJSON(
            '/api/cnes/create_project?key='+projectKey+'&name='+name+'&gate='+qualityGate+'&profiles='+qualityProfile
        ).then(function (response) {
            // log response
            log('[INFO] Project created successfully: ' + response.success);
            log('[INFO] Project creation log:\n' + response.logs);
            // if success we call the next function (analysis)
            if(response.success) {
                callback(projectKey, name, folder, qualityGate, qualityProfile, spp, author,
                         version, description, sources, produceReport);
            } else {
                // unlock form
                setEnabled(true);
            }
        }).catch(function (error) {
            // log error
            log(error);
            // unlock form
            setEnabled(true);
        });
    };

    /**
     * Wait that sonarqube has finished to import the report to run a callback
     * @param key
     * @param name
     * @param qualitygate
     * @param author
     * @param callback
     */
    var waitSonarQube = function(key, name, qualitygate, author, callback) {
        // send get request to the cnes web service
        // we ask for information about task about a project
        window.SonarRequest.getJSON(
            '/api/ce/component',
            { componentKey: key }
        ).then(function (response) {
            // on success

            // if there are no queued task
            // so it is ready to report
            if(response.queue.length === 0) {
                // produce the report
                callback(key, name, qualitygate, author);
            } else {
                // retry later (in 2 seconds)
                window.setTimeout(waitSonarQube(key, name, qualitygate, author, callback), 2000);
            }

        }).catch(function (error) {
            // log error
            log("[ERROR] " + error);
            // unlock form
            setEnabled(true);
        });
    };

    /**
     * Complete automatically the sonar-project.properties to add information
     * computable from form's fields
     * @param spp
     * @param key
     * @param name
     * @param qualityprofile
     * @param version
     * @param description
     * @param sources
     * @return Modified spp with automatic data
     */
    var completeSPP = function (spp, key, name, qualityprofile, version, description, sources) {
        // complete the spp with projectKey and projectName
        spp = spp.concat("\nsonar.projectKey="+key);
        spp = spp.concat("\nsonar.projectName="+name);

        // complete the spp with version and description
        spp = spp.concat("\nsonar.projectVersion="+version);
        spp = spp.concat("\nsonar.projectDescription="+description);

        // complete the spp with sources repository
        spp = spp.concat("\nsonar.sources="+sources);

        // if a python quality profile is set and there are no pylintrc set
        if(qualityprofile.indexOf("cnes_python")!==-1 && spp.indexOf("sonar.python.pylint_config")===-1) {
            // sonar pylint configuration property
            var pylintrcSonar = "\nsonar.python.pylint_config=";
            // path to configuration files
            var configurationPath = "/home/labo/Documents/VM_LEQUAL/conf/python/";
            // name of the configuration file to use
            var filename = "pylintrc_RNC_sonar_2017_D";
            // we append the appropriate one
            // check if there is a rated A or B profile and add the corresponding file
            if(qualityprofile.indexOf("cnes_python_a") !== -1 || qualityprofile.indexOf("cnes_python_b") != -1) {
                filename = "pylintrc_RNC_sonar_2017_A_B";
                spp = spp.concat(pylintrcSonar+configurationPath+filename);
                log("[INFO] Use of configuration file "+filename+" for Pylint.");
            // check if there is a rated C profile and add the corresponding file
            } else if(qualityprofile.indexOf("cnes_python_c") !== -1) {
                filename = "pylintrc_RNC_sonar_2017_C";
                spp = spp.concat(pylintrcSonar+configurationPath+filename);
                log("[INFO] Use of configuration file "+filename+" for Pylint.");
            // otherwise it is a D configuration to use
            } else {
                spp = spp.concat(pylintrcSonar+configurationPath+filename);
                log("[INFO] Use of configuration file "+filename+" for Pylint.");
            }
        }

        return spp;
    };

    /**
     * Run the analysis
     * @param key
     * @param name
     * @param folder
     * @param qualitygate
     * @param qualityprofile
     * @param spp
     * @param author
     * @param version
     * @param description
     * @param sources
     * @param callback
     */
    var runAnalysis = function (key, name, folder, qualitygate, qualityprofile, spp, author,
                                version, description, sources, callback) {

        // auto complete the sonar-project properties
        spp = completeSPP(spp, key, name, qualityprofile, version, description, sources);

        // log the finally used spp
        log("[INFO] Here comes the finally used sonar-project.properties:\n" + spp);

        // send post request to the cnes web service
        window.SonarRequest.postJSON(
            '/api/cnes/analyze',
            { key: key, name: name, folder: folder, qualitygate: qualitygate, qualityprofile: qualityprofile, sonarProjectProperties: spp }
        ).then(function (response) {
            // on success
            // log output
            log("[INFO] Project analysis response: \n" + response.logs);
            // wait that sonarqube has finished to import the report to produce the report
            log("[INFO] SonarQube is still importing the report, please wait.");
            waitSonarQube(key, name, qualitygate, author, callback);
        }).catch(function (error) {
            // log error
            log("[ERROR] Project analysis failed.");
            log(error);
            // unlock form
            setEnabled(true);
        });
    };

    /**
     * Function which groups element by key
     * @param array
     * @param key
     */
    var groupBy = function(array, key) {
        return array.reduce(function(rv, x) {
            (rv[x[key]] = rv[x[key]] || []).push(x);
            return rv;
        }, {});
    };

    /**
     *  Get quality gates from the server and fill out the combo box
     */
    var initQualityGateDropDownList = function() {
        window.SonarRequest.getJSON(
            '/api/qualitygates/list'
        ).then(function (response) {
            // on success
            // we put each quality gate in the list
            $.each(response.qualitygates, function (i, item) {
                // we create a new option for each quality gate
                // in the json response
                var option = $('<option>', {
                                 value: item.name,
                                 text : item.name
                             });
                // we add it to the drop down list
                $('#quality-gate').append(option);
                // we select as a default value the default quality gate
                if(item.id===response.default) {
                    $('#quality-gate').val(item.name);
                }
            });
        }).catch(function (error) {
            // log error
            log("[ERROR] " + error);
        });
    };

    /**
     *  Get quality profiles from the server and fill out the combo box
     */
    var initQualityProfileDropDownList = function() {
        var id = '#quality-profile';

        window.SonarRequest.getJSON(
            '/api/qualityprofiles/search'
        ).then(function (response) {
            // on success

            // sort profiles by language
            var sorted = groupBy(response.profiles, 'languageName');

            // and create an option group for each language
            $.each(sorted, function (j, cat) {
                var category = $('<optgroup>', {
                                    label: j
                                });
                $(id).append(category);
                // we put each quality profiles in the list
                $.each(cat, function (i, item) {
                    // we create a new option for each quality profile
                    // in the json response
                    var option = $('<option>', {
                                     value: item.key,
                                     text : item.name
                                 });
                    // we add it to the drop down list
                    category.append(option);
                    // we select as a default value the default quality profile
                    if(item.isDefault) {
                        //$(id).val(item.name);
                    }
                });
            });
        }).catch(function (error) {
            // log error
            log("[ERROR] " + error);
        });
    };

    /**
     *  Return a well formatted string for the profile argument of the web service
     *  @param options
     */
    var optionsToString = function(options) {
        var result = "";

        // we concatenate all profiles' name in a string
        // separated by ';'
        for (var i = 0; i < options.length; ++i) {
            // add a separator when necessary
            if(i>0) {
                result = result + ';';
            }
            result = result + options[i].value;
        }

        return result.replace(new RegExp('\\+', "g"), '%2B');
    }

    // once the request is done, and the page is still displayed (not closed already)
    if (isDisplayedAnalysis) {

        // Add html template
        var template = document.createElement("div");
        template.setAttribute("id", "template");
        options.el.appendChild(template);

        // url of the template to load
        var urlTemplate = checkPermissions() ? '../../static/cnesscan/templates/analysisForm.html' : '../../static/cnesscan/templates/denied.html';

        // add the form if user has permission otherwise the denied access page
        $('#template').load(urlTemplate, function () {

            // set analyze button action
            var analyzeButton = document.querySelector('#analyze');
            // set its action on click
            analyzeButton.onclick = function () {

                // clear logs
                clearLog();

                // hide loading
                $('#loading').hide();

                // validation of the form
                if (checkForm()) {

                    // Get form values
                    var key = document.forms["analyze-form"]["key"].value;
                    var name = document.forms["analyze-form"]["name"].value;
                    var folder = document.forms["analyze-form"]["folder"].value;
                    var qgate = document.forms["analyze-form"]["quality-gate"].value;
                    var qprofile = optionsToString(document.forms["analyze-form"]["quality-profile"].selectedOptions);
                    var author = document.forms["analyze-form"]["author"].value;
                    var spp = document.forms["analyze-form"]["spp"].value;
                    var version = document.forms["analyze-form"]["version"].value;
                    var description = document.forms["analyze-form"]["description"].value;
                    var sources = document.forms["analyze-form"]["sources"].value;

                    // lock the form
                    setEnabled(false);

                    // show loading
                    $('#loading').show();

                    // request the creation of the project
                    createProject(key, name, folder, qgate, qprofile, spp, author,
                                    version, description, sources, runAnalysis);
                }
            };

            // get copy button in the DOM
            var copyButton = document.querySelector('#copy');
            // set copy button action
            copyButton.onclick = function () {
                // get logging text area
                var toCopy = document.getElementById('logging');
                // select the text area to copy it in the clipboard
                toCopy.select();
                document.execCommand('copy');
                return false;
            }

            // fill out quality gate drop down list
            initQualityGateDropDownList();

            // fill out quality profiles drop down list
            initQualityProfileDropDownList();

        });
    }

    // return a function, which is called when the page is being closed
    return function () {
        // we unset the `isDisplayedAnalysis` flag to ignore to Web API calls finished after the page is closed
        isDisplayedAnalysis = false;
        // clear elements of this page
        options.el.textContent = '';
    };
});