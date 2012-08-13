/*jshint browser: true, devel: true, bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global require*/
require(["reader", "expander", "evaluator", "util"], function (reader, expander, evaluator, util) {

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
    
    function evaluate(name, input) {
        run("evaluator", name, input, function (x) {
            return evaluator.print(evaluator.evaluate(expander.expand(reader.read(x))).value);
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
        
        // ---
        
        expand("symbols", ["a", ".length"]);
        expand("literals", ["5", "5.2", "0xFF", '"word"']);
        expand("comments", ["; sup?"]);
        
        expand("1-item paren list", "(a)");
        
        expand("comments in lists", ["(do\n;some\nthing)"]);
        
        // ---
        
        evaluate("literals", ["5", "5.2", "0xFF", '"hello"', "#t"]);
        evaluate("variables", "(var a 500) a");
        
        evaluate("function defs", ["(fn () 5)", "(fn (x) x)", "(fn (x y) y)", "(fn x x)"]);
        evaluate("function application", ["(var id (fn (x) x)) (id 5)", "(var id-args (fn x x)) (id-args 1 2 3)"]);
        
        evaluate("cons car cdr", "(var cons (fn (x y) (fn (m) (m x y)))) (var car (fn (z) (z (fn (p q) p)))) (var cdr (fn (z) (z (fn (p q) q)))) (car (cdr (cons 1 (cons 2 3))))");
        
        evaluate("assignment", "(var a 500) (set! a 1) a");
        
        // TODO: test empty list truthiness
        evaluate("if", ["(if 1 #t #f)", "(if 0 #t #f)"]);
        
        evaluate("quoting", ["'1", "'()", "'a", "'(1 2 3)", "'(fn () 10)", "''(1 2 3)"]);
        
        evaluate("quasiquoting", ["(var a 10) `(1 ,a)", "(var a 10) `(1 '(2 ,a))", "(var a 10) (var b '(2 ,a)) `(1 ,b)"]);
        
        if (!errored) {
            trace("status", "It's all good.", new Date().getTime() - t, "ms.");
        }
    };

    window.onerror = function (e) {
        trace("status", "There was an error:", e);
        errored = true;
    };
    
});