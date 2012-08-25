/*jshint node: true, bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
(function () {

    "use strict";

    var requirejs = require("requirejs");
    var path = require("path");
    var nodeRequire = require;
    requirejs.config({
        nodeRequire: nodeRequire,
        baseUrl: path.resolve(path.dirname(process.argv[2]))
    });
    
    requirejs([process.argv[2]], function(runner) {
        runner();
    });
    
}());