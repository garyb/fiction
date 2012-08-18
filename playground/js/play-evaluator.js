/*jshint browser: true, devel: true, bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global require, $*/
require(["playground", "reader", "expander", "evaluator", "util"], function (playground, reader, expander, evaluator, util) {

    "use strict";
    
    var trace = playground.trace;
    var run = playground.run;
    
    function handleImport(name, k) {
        $.ajax({
            url: "fic/" + name + ".fic",
            dataType: "text",
            success: function (data) {
                k(reader.read(data));
            },
            error: function () {
                throw arguments[2];
            }
        });
    }
    
    function evaluate(name, input, k) {
        run(name, input, function (x, k) {
            expander.expand(reader.read(x), handleImport, function (result) {
                trace("output", x, "=", util.printPretty(evaluator.evaluate(result).value));
                k();
            });
        }, k);
    }
    
    window.onload = function () {

        var t = new Date().getTime();
        
        var things = [];

        things.push(["literals", ["5", "5.2", "0xFF", '"hello"', "#t"]]);
        things.push(["variables", "(var a 500) a"]);
        
        things.push(["function defs", ["(fn () 5)", "(fn (x) x)", "(fn (x y) y)", "(fn x x)"]]);
        things.push(["function application", ["(var id (fn (x) x)) (id 5)", "(var id-args (fn x x)) (id-args 1 2 3)"]]);
        
        things.push(["cons car cdr", "(var cons (fn (x y) (fn (m) (m x y)))) (var car (fn (z) (z (fn (p q) p)))) (var cdr (fn (z) (z (fn (p q) q)))) (car (cdr (cons 1 (cons 2 3))))"]);
        
        things.push(["assignment", "(var a 500) (set! a 1) a"]);
        
        things.push(["if", ["(if 1 #t #f)", "(if 0 #t #f)", "(if '() #t #f)", "(if (fn () 4) #t #f)"]]);
        
        things.push(["quote", ["'1", "'()", "'a", "'(1 2 3)", "'(fn () 10)", "''(1 2 3)"]]);
        things.push(["quasiquote & unquote", ["(var a 10) `(1 ,a)", "(var a 10) `(1 '(2 ,a))", "(var a 10) (var b '(2 ,a)) `(1 ,b)", "`(1 ,'(2 3) 4)"]]);
        things.push(["unquote-splicing", ["`(1 ,@'(2 3) 4)", "`(,@'(5))", "`(1 ,@'() 4)", "(var a '(1 2)) `(5 ,@a)"]]);
        
        var runThings = function () {
            if (things.length > 0) {
                var params = things.shift();
                evaluate.apply(null, params.concat([runThings]));
            } else {
                trace("status", "It's all good.", new Date().getTime() - t, "ms.");
            }
        };
        
        runThings();
    };    
});