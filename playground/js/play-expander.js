/*jshint browser: true, devel: true, bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global require*/
require(["playground", "reader", "expander", "util"], function (playground, reader, expander, util) {

    "use strict";
    
    var trace = playground.trace;
    var run = playground.run;
    
    function expand(name, input) {
        run(name, input, function (x, k) {
            trace("output", x, "=", (expander.expand(reader.read(x))).map(util.printPretty).join(" "));
            k();
        });
    }
    
    window.onload = function () {

        var t = new Date().getTime();

        expand("symbols", ["a", ".length"]);
        expand("literals", ["5", "5.2", "0xFF", '"word"']);
        expand("comments", ["; sup?"]);
        
        expand("1-item paren list", "(a)");
        
        expand("comments in lists", ["(do\n;some\nthing)"]);
        
        trace("status", "It's all good.", new Date().getTime() - t, "ms.");
    };    
});