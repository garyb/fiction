/*jshint browser: true, devel: true, bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global require*/
require(["reader", "expander", "util"], function (reader, expander, util) {

    "use strict";
    
    function trace() {
        var arr = Array.prototype.slice.apply(arguments);
        var out = document.getElementById(arr[0]);
        out.innerHTML += arr.slice(1).join(" ") + "\n";
    }

    var errored = false;

    function run(cat, name, input, runner) {
        if (errored) {
            return;
        }
        document.getElementById(cat).parentNode.className = "block populated";
        trace(cat, name + ":");
        if (Array.isArray(input)) {
            for (var i = 0; i < input.length; i++) {
                trace(cat, input[i], "=", runner(input[i]));
            }
        } else {
            trace(cat, input, "=", runner(input));
        }
        trace(cat);
    }
    
    function read(name, input) {
        run("reader", name, input, function (x) {
            return util.printRawForm(reader.read(x));
        });
    } 
    
    function expand(name, input) {
        run("expander", name, input, function (x) {
            return util.printRawForm(expander.expand(reader.read(x)));
        });
    }

    window.onload = function () {

        var t = new Date().getTime();

        read("symbols", ["a", "lower", "UPPER", "camelCase", "CamelCase", "j0", "hyphen-ated", "under_scored", "dot.ted", ".length", "úņīčőđē"]);
        
        read("ints", "5");
        read("floats", "5.2");
        read("hex", "0xFF");
        
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
        
        // ---
        
        expand("symbols", ["a", ".length"]);
        expand("literals", ["5", "5.2", "0xFF", '"word"']);
        expand("comments", ["; sup?"]);
        
        expand("1-item paren list", "(a)");
        
        expand("comments in lists", ["(do\n;some\nthing)"]);
        
        if (!errored) {
            trace("status", "It's all good.", new Date().getTime() - t, "ms.");
        }
    };

    window.onerror = function (e) {
        trace("status", "There was an error:", e);
        errored = true;
    };
    
});