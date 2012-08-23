/*jshint node: true, bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
(function () {

    "use strict";

    var requirejs = require("requirejs");
    var fs = require("fs");
    var path = require("path");

    requirejs.config({ nodeRequire: require });

    requirejs(["reader", "expander", "compiler"], function (reader, expander, compiler) {
    
        var args = process.argv;
        
        if (args.length !== 4) {
            console.log("Usage: fiction [input] [output]");
        } else {
    
            var input = process.argv[2];
            var output = process.argv[3];
            
            var handleImport = function (name, k) {
                k(reader.read(fs.readFileSync(path.resolve(path.dirname(input), name + ".fic"), "utf8")));
            };
            
            var str = fs.readFileSync(input, "utf8");
            var exprs = reader.read(str);
            expander.expand(exprs, handleImport, function (result) {
                var js = compiler.compile(result);
                js = "/*jshint bitwise: true, curly: true, eqeqeq: true, forin: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true*/\n/*global define*/\n" + js;
                fs.writeFileSync(output, js);
                console.log("Done!");
            });
        }
    });

}());