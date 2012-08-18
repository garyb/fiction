/*jshint browser: true, devel: true, bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(function () {

    "use strict";
    
    function trace() {
        var arr = Array.prototype.slice.apply(arguments);
        var out = document.getElementById(arr[0]);
        out.innerHTML += arr.slice(1).join(" ") + "\n";
    }

    var errored = false;

    function run(name, input, runner, k) {
    
        if (errored) {
            return;
        }
        
        var end = function () {
            trace("output");
            if (k) { 
                k();
            }
        };
        
        trace("output", name + ":");
        if (Array.isArray(input)) {
            var ins = input.slice();
            var next = function () {
                if (ins.length > 0) {
                    runner(ins.shift(), next);
                } else {
                    end();
                }
            };
            next();
        } else {
            runner(input, end);
        }
    }
    
    window.onerror = function (e) {
        trace("status", "There was an error:", e);
        errored = true;
    };
    
    return {
        trace: trace,
        run: run
    };
    
});