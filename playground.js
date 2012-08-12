/*jshint browser: true, devel: true, bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global require*/
require(["src/reader"], function (reader) {

    "use strict";
    
    function trace() {
        var arr = Array.prototype.slice.apply(arguments);
        var out = document.getElementById("out");
        out.innerHTML += arr.join(" ") + "\n";
    }

    var errored = false;

    function run(name, input) {
        if (errored) {
            return;
        }
        trace(name + ":");
        if (Array.isArray(input)) {
            for (var i = 0; i < input.length; i++) {
                trace(input[i], "=", reader.read(input[i]).join(", "));
            }
        } else {
            trace(input, "=", reader.read(input).join(", "));
        }
        trace();
    }

    window.onload = function () {

        var t = new Date().getTime();

        run("symbols", ["a", "lower", "UPPER", "camelCase", "CamelCase", "j0", "hyphen-ated", "under_scored", "dot.ted", ".length", "úņīčőđē"]);
        
        run("ints", "5");
        run("floats", "5.2");
        run("hex", "0xFF");
        
        run("strings", ['"word"', '"how long is a piece of..."; string', '"escape \\"this\\""']);
        
        run("comments", ["; sup?", "; an expr:\n(do 1)"]);
        
        run("empty paren list", "()");
        run("empty bracket list", "[]");
        run("empty brace list", "{}");   
        
        run("1-item paren list", "(a)");
        run("1-item bracket list", "[a]");
        run("1-item brace list", "{a}");
        
        run("2-item paren list", "(a 5)");
        run("2-item bracket list", "[a 5]");
        run("2-item brace list", "{a 5}");
        
        run("quoting", ["'a", "'5", "'()", "'(a)", "'(a 5)"]);
        run("quasiquoting", ["`a", "`5", "`()", "`(a)", "`(a 5)"]);
        run("unquoting", [",a", ",5", ",()", ",(a)", ",(a 5)"]);
        run("unquote-splicing", [",@a", ",@5", ",@()", ",@(a)", ",@(a 5)"]);
        
        if (!errored) {
            trace("It's all good.", new Date().getTime() - t, "ms.");
        }
    };

    window.onerror = function (e) {
        trace("There was an error:", e);
        errored = true;
    };
    
});