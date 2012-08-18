/*jshint browser: true, devel: true, bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global require*/
require(["playground", "reader", "util"], function (playground, reader, util) {

    "use strict";
    
    var trace = playground.trace;
    var run = playground.run;
    
    function read(name, input) {
        run(name, input, function (x, k) {
            trace("output", x, "=", util.printRawForm(reader.read(x)));
            k();
        });
    }
    
    window.onload = function () {

        var t = new Date().getTime();

        read("symbols", ["a", "lower", "UPPER", "camelCase", "CamelCase", "j0", "hyphen-ated", "under_scored", "dot.ted", ".length", "úņīčőđē"]);
        
        read("numbers", ["5", "5.2"]);
        read("hex numbers", "0xFF");
        
        read("booleans", ["#t", "#f"]);
        
        read("strings", ['"word"', '"how long is a piece of..."; string', '"escape \\"this\\""']);
        
        read("comments", ["; sup?", "; an expr:\n(do 1)"]);
        
        read("empty paren list", "()");
        read("empty bracket list", "[]");
        read("empty brace list", "{}");   
        
        read("1-item paren list", "(a)");
        read("1-item bracket list", "[a]");
        read("1-item brace list", "{a}");
        
        read("2-item paren list", "(a 5)");
        read("2-item bracket list", "[a 5]");
        read("2-item brace list", "{a 5}");
        
        read("multiline paren list", ["(do\nsome\nthing)", "(do\n;some\nthing)"]);
        
        read("quoting", ["'a", "'5", "'()", "'(a)", "'(a 5)"]);
        read("quasiquoting", ["`a", "`5", "`()", "`(a)", "`(a 5)"]);
        read("unquoting", [",a", ",5", ",()", ",(a)", ",(a 5)"]);
        read("unquote-splicing", [",@a", ",@5", ",@()", ",@(a)", ",@(a 5)"]);
        
        trace("status", "It's all good.", new Date().getTime() - t, "ms.");
    };    
});