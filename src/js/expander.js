/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util"], function (util) {

    "use strict";
    
    var checkForm = util.checkForm;
    
    // TODO: expander needs to perform identifier remapping instead of waiting 
    // until the compile stage - this is necessary to maintain macro hygiene 
    // when free identifiers are used in macro templates, as free identifiers 
    // need to refer to the identifier in the macro's scope:
    // e.g. if macro `m1` is rewritten to `a`:
    // (var a 50)
    // (m1); = 50
    // (let ((a 1000)) (m1)) ; still = 50
    
    function error(msg, form) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg + " @ " + util.printRawForm(form));
    }
       
    function expandComment() {
        return null;
    }
    
    function getSymbolValue(form) {
        if (form.type !== "symbol") {
            error("expected symbol", form);
        }
        return form.value;
    }
    
    function expandDefineSyntax(form) {
        if (form.value.length !== 3 || !checkForm(form.value[2], "syntax-rules")) {
            error("define-syntax: bad syntax", form);
        }
        var id = getSymbolValue(form.value[1]);
        var rules = form.value[2];
        if (rules.type !== "list") {
            error("define-syntax: bad syntax", form);
        }
        var reserved = form.value[2].value[1].value.map(getSymbolValue);
        
        console.log(id, reserved);
        rules = rules.value.slice(2);
        
        for (var i = 0, l = rules.length; i < l; i++) {
            var rule = rules[i];
            if (rule.type !== "list" || rule.value.length !== 2) {
                error("define-syntax: bad syntax", rule);
            }
            var pattern = rule.value[0];
            var template = rule.value[1];
            console.log("pat:", util.printPretty(pattern));
            console.log("tem:", util.printPretty(template));
        }
        
        return null;
    }
    
    var expanders = {
        "comment": expandComment,
        "define-syntax": expandDefineSyntax
    };

    function expand(form) {
        if (form.type === "list" && form.value.length > 0) {
            var car = form.value[0];
            if (car.type === "symbol") {
                var expander = expanders[car.value];
                if (expander) {
                    return expander(form);
                }
            }
            form.value = expandAll(form.value);
        }
        return form;
    }
    
    function expandAll(seq) {
        var result = [];
        for (var i = 0, l = seq.length; i < l; i++) {
            var form = expand(seq[i]);
            if (form !== null) {
                result.push(form);
            }
        }
        return result;
    }

    return { expand: expandAll };

});