﻿(function() {
    'use strict';

    // TODO: replace app with your module name
    angular.module('app').directive('dashboardTestDirective', ['$window', dashboardTestDirective]);
    
    function dashboardTestDirective($window) {
        // Usage:
        // 
        // Creates:
        // 
        var directive = {
            link: link,
            replace: true,     //<-- Replace the directive element with the template completly
            restrict: 'AEC',    //<-- Allows use as: Attribute, Element and Class
            templateUrl: '/angular/dashboard/templates/dashboardTestDirective.html',      //<-- replaces inline version of ---->   template: '<p>Test Directive</p>'
            scope: {
                // variables
                message: "=",
                loaderType: "="
            }
        };
        return directive;

        function link(scope, element, attrs) {
        }
    }

})();