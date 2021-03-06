﻿(function () {
    'use strict';

    var controllerId = 'searchController';

    // Inject into main app module:
    angular.module('app')
        .controller(controllerId, [
            'accountServices',
            'categoryServices',
            'searchServices',
            'propertyServices',
            '$scope',
            '$filter',
            '$location',
            '$window',
            '$routeParams',
             searchController
    ]);

    function searchController(accountServices, categoryServices, searchServices, propertyServices, $scope, $filter, $location, $window, $routeParams) {

        //Instantiate Controller as ViewModel
        var vm = this;

        //Default Properties: =============================
        vm.title = 'searchController';
        vm.activate = activate;

        vm.loading = true;
        vm.accountNameKey = null;
        vm.apiDomain = null;
        vm.account = null;



        /* ==========================================
               Helper Methods
        ==========================================*/

        // Debug Methods ===================================
        // wrap console.log() within the "Debug" namespace
        //    -->  Logs can be removed during minification
        var Debug = {};
        Debug.trace = function (message) {
            console.log(message);
        };

        /* ==========================================
               RE-ROUTING
        ==========================================*/

        vm.loadProduct = function(path)
        {
            //$window.location.href = ("/product/" + path);

            var win = window.open('/item/' + path, '_blank');
            if (win) {
                //Browser has allowed it to be opened
                win.focus();
            } else {
                //Browser has blocked it
                $window.location.href = ("/item/" + path);
            }
        }

        vm.updateRoute = function(path)
        {
            //window.location.replace(path);
            $window.location.href = path;
            //$location.path(path)
        }

        /* ==========================================
               GET ACCOUNT SETTINGS
           ==========================================*/

        

        vm.getAccountSettings = function () {

            accountServices.getAccount(vm.accountNameKey, vm.apiDomain)
            .success(function (data, status, headers, config) {
                
                vm.account = data.account;

                document.title = vm.account.accountName;

                vm.getSearchFacets();
                vm.getSearchSortables();
                vm.initializeCategorizations();
                vm.getFeaturedProperties();
                

            })
            .error(function (data, status, headers, config) {

            })
        }

        // ------ Properties (Listings) -------

        vm.featuredProperties = null;

        vm.getFeaturedProperties = function () {

            propertyServices.getPropertiesFiltered(vm.accountNameKey, vm.apiDomain, 'featured', 'listingsOnly')
            .success(function (data, status, headers, config) {

                vm.featuredProperties = data.properties;

            })
            .error(function (data, status, headers, config) {

            })
        }

        /* ==========================================
               Theming
        ==========================================

        //var base = { 'background-color': 'blue' }

        //vm.theme = {
        //base : base
        //}

        var setTheme = function () {
            document.body.style.background = "#" + vm.account.themeSettings.colors.background;
            document.body.style.foreground = "#" + vm.account.themeSettings.colors.foreground;
            document.title = vm.account.accountName;
        }
       
        */















































        vm.switchSearchMode = function (mode, refreshPage) {
            if (!refreshPage) {
                vm.searchMode = mode;

                //Set default amountsPerPage
                if (vm.searchMode == 'list') {
                    vm.defaultAmountPerPage = 48;
                }
                else if (vm.searchMode == 'map') {
                    vm.defaultAmountPerPage = 36;
                }

                vm.amountPerPage = vm.defaultAmountPerPage;
            }
            else if (refreshPage) {
                if (mode == 'map') {
                    window.location.href = '/search/map';;
                }
                else if (mode == 'list') {
                    window.location.href = '/search';;
                }
            }

        }

        vm.searchMode = "list"
        vm.pageLoaded = false;

        if ($routeParams.searchMode) {
            vm.switchSearchMode($routeParams.searchMode, false);
        }
        else {
            vm.switchSearchMode(vm.searchMode, false);
        }

        vm.paginationInfo =
        {
            pageStartAt: 0,
            pageEndAt: 0,
            lastResultCount: 0,
            //pageAmountToSubtract: 0,

            reset: function () {
                this.pageStartAt = 0;
                this.pageEndAt = 0;
                this.lastResultCount = 0;
                //this.pageAmountToSubtract = 0;
            }
        }


        //var defaultListAmountPerPage = 48;
        //var defaultMapMarkerAmountPerPage = 24;

        //Only allow Google Maps to initiate ONCE per controller creation!
        vm.mapsInitiated = false;
        var map = null;


        /* ==========================================
               Search Methods
        ==========================================*/

        vm.searching = false;
        vm.searchQuery = "";
        vm.searchQueryCompleted = null;
        vm.filterString = "";
        //vm.orderBy = "Relevance"

        vm.filterQueryArray = [];

        //For UI
        vm.filterStringsArray = [];
        vm.categorizationStringHtml = null;


        //Infinite Scroll Specific
        vm.searchingMore = false;
        //vm.disableInfiniteScroll = false; //<-- Used to lock it for short duration during api calls
        vm.infiniteScroll = true; //<-- Used to lock it completely if in mobile view
        vm.amountToSkip = 0;

        vm.searchResults = null;

        //vm.mapInitialized = false;
        var mapHeightOffset = 75;

        vm.search = function () {
            vm.paginationInfo.reset();

            vm.updateUIBasedOnWidth(); //<-- Called first time

            vm.resetInfiniteScroll();

            vm.showCategoryUpdateButton = false;
            vm.searching = true;

            //For service calls
            vm.filterQueryArray = [];
            vm.categorizationFilterString = "";
            vm.filterString = "";

            //For UI
            vm.filterStringsArray = [];
            vm.categorizationStringHtml = null;


            //build out filterstring ----------------------------------------

            //Categorizations
            if (vm.searchCategorization.Category != null) {
                vm.categorizationFilterString = "categoryNameKey eq '" + vm.searchCategorization.Category.nameKey + "'";

                vm.categorizationStringHtml = vm.searchCategorization.Category.name
            }
            if (vm.searchCategorization.Subcategory != null) {
                vm.categorizationFilterString = "categoryNameKey eq '" + encodeURIComponent(vm.searchCategorization.Category.nameKey) + "' and ";
                vm.categorizationFilterString += "subcategoryNameKey eq '" + encodeURIComponent(vm.searchCategorization.Subcategory.nameKey) + "'";

                vm.categorizationStringHtml = vm.searchCategorization.Category.name +
                    "/" + vm.searchCategorization.Subcategory.name
            }
            if (vm.searchCategorization.Subsubcategory != null) {
                vm.categorizationFilterString = "categoryNameKey eq '" + encodeURIComponent(vm.searchCategorization.Category.nameKey) + "' and ";
                vm.categorizationFilterString += "subcategoryNameKey eq '" + encodeURIComponent(vm.searchCategorization.Subcategory.nameKey) + "' and ";
                vm.categorizationFilterString += "subsubcategoryNameKey eq '" + encodeURIComponent(vm.searchCategorization.Subsubcategory.nameKey) + "'";

                vm.categorizationStringHtml = vm.searchCategorization.Category.name +
                    "/" + vm.searchCategorization.Subcategory.name +
                    "/" + vm.searchCategorization.Subsubcategory.name
            }
            if (vm.searchCategorization.Subsubsubcategory != null) {
                vm.categorizationFilterString = "categoryNameKey eq '" + encodeURIComponent(vm.searchCategorization.Category.nameKey) + "' and ";
                vm.categorizationFilterString += "subcategoryNameKey eq '" + encodeURIComponent(vm.searchCategorization.Subcategory.nameKey) + "' and ";
                vm.categorizationFilterString += "subsubcategoryNameKey eq '" + encodeURIComponent(vm.searchCategorization.Subsubcategory.nameKey) + "' and ";
                vm.categorizationFilterString += "subsubsubcategoryNameKey eq '" + encodeURIComponent(vm.searchCategorization.Subsubsubcategory.nameKey) + "'";

                vm.categorizationStringHtml = vm.searchCategorization.Category.name +
                    "/" + vm.searchCategorization.Subcategory.name +
                    "/" + vm.searchCategorization.Subsubcategory.name +
                    "/" + vm.searchCategorization.Subsubsubcategory.name
            }


            //Facets

            for (var i = 0; i < vm.facets.length; i++) {

                var filterUIValues = "";
                var filterValues = "";

                //For Search Query Array:
                var filterQueryObject = { PropertyName: vm.facets[i].name, BooleanOperator: vm.facets[i].BooleanOperator, values: [] };
                vm.filterQueryArray.push(filterQueryObject)

                //vm.facets[i]["HasSelectedItems"] = false; //<-- Cannot show advanced options (Defualt, reset of ann searches)
                var selectedItemsCount = 0;

                if (vm.facets[i].type != 'location') {
                    for (var f = 0; f < vm.facets[i].values.length; f++) {

                        if (vm.facets[i].values[f].Selected == true) {
                            selectedItemsCount++;

                            //For Results UI:
                            if (filterUIValues != "") {
                                filterUIValues += "--operator--"
                            }
                            filterUIValues = filterUIValues + vm.facets[i].values[f].name

                            //For search query
                            //Append to vm.filterQueryArray
                            vm.filterQueryArray[i].values.push(encodeURIComponent(vm.facets[i].values[f].filter))

                        }
                    }

                }

                vm.facets[i]["SelectedItemCount"] = selectedItemsCount

                if (selectedItemsCount > 1) {
                    vm.facets[i]["HasSelectedItems"] = true; //<-- Can show advanced options (yes if any selections above 1 are made)

                    //Set drawer header to black to indicate use of filters:
                    /*
                    $timeout(function(){
                            $('#filter-' + vm.facets[i].key + '-header-color-closed').css('color', 'black');
                            $('#filter-' + vm.facets[i].key + '-header-color-open').css('color', 'black');
                        },200
                    )*/
                    
                }
                else {
                    vm.facets[i]["HasSelectedItems"] = false; //<-- Reset to all default values)
                    vm.facets[i].BooleanOperator = "and"; //<-- Reset to all default values)
                    vm.facets[i].ShowAdvanced = false; //<-- Reset to all default values)

                    //Set drawer header to black to indicate use of filters:
                    /*
                    $timeout(function () {
                        $('#filter-' + vm.facets[i].key + '-header-color-closed').css('color', 'darkgray');
                        $('#filter-' + vm.facets[i].key + '-header-color-open').css('color', 'darkgray');
                    }, 200
                    )*/
                }

                //For Results UI:

                var booleanOperatorUIString = "";
                if (vm.facets[i].BooleanOperator == "and") {
                    booleanOperatorUIString = " + "
                }
                else if (vm.facets[i].BooleanOperator == "or") {
                    booleanOperatorUIString = " or "
                }

                filterUIValues = filterUIValues.replace(/--operator--/g, booleanOperatorUIString);
                //filterUIValues = filterUIValues.replace(/;([^,]*)$/, booleanOperatorUIString + '$1') //<-- Replace last "; " with " or " or " & "
                if (filterUIValues != "") {
                    var filterUiObject = { label: vm.facets[i].name, values: filterUIValues };
                    vm.filterStringsArray.push(filterUiObject)
                }

            }






            // =====================================
            // =========== BUILD THE QUERY ============

            //Build the query string from the filterQueryArray object using EVERY possible variation
            //console.trace(vm.filterQueryArray); //<-- Will have every property represented

            //Remove all indexes that do not have values (since we collected EVERY single facetable property)
            //(We loop through backwards so shifting indexes don't skip/misalign the indexes to remove!)
            for (var i = vm.filterQueryArray.length - 1; i >= 0; i--) {
                if (vm.filterQueryArray[i].values.length <= 0) {
                    //console.log("(" + i + ")removing: " + vm.filterQueryArray[i].PropertyName);
                    vm.filterQueryArray.splice(i, 1);
                }
            }

            if (vm.filterQueryArray.length > 0) {
                //We only generate the filter string if there is data in the array to generate from

                //Loop through all items and append to filter string
                for (var i = 0; i < vm.filterQueryArray.length; i++) {

                    vm.filterString += "("

                    for (var v = 0; v < vm.filterQueryArray[i].values.length; v++) {

                        vm.filterString += vm.filterQueryArray[i].values[v];

                        if (v < vm.filterQueryArray[i].values.length - 1) {
                            vm.filterString += " " + vm.filterQueryArray[i].BooleanOperator + " "; //<---and/or
                        }
                    }

                    vm.filterString += ")"

                    if (i < vm.filterQueryArray.length - 1) {
                        vm.filterString += " and "
                    }
                }
            }



            var additionalLocationSorting = null;
            //APPEND LOCATION QUERY IF AVAILABLE
            if (vm.locationSearch.available) {

                //GEOSPATIAL FILTER EXAMPLES
                //$filter=geo.distance(location, geography'POINT(-122.131577 47.678581)') le 10  
                //$filter=geo.intersects(location, geography'POLYGON((-122.031577 47.578581, -122.031577 47.678581, -122.131577 47.678581, -122.031577 47.578581))') 
                //$filter=geo.intersects(location, geography'POLYGON((-123.89321477187502 46.91718330345233, -117.58706242812502 48.57181402986399,-117.58706242812502 48.57181402986399, -123.89321477187502 46.91718330345233))'))

                if (vm.locationSearch.bounds == null) {
                    //QUERY BASED ON DISTACE FROM CENTER

                    //BUILD OUT FILTER QUERY:
                    var distanceKm = 0;

                    if (vm.locationSearch.distanceType == 'kilometers') {
                        distanceKm = vm.locationSearch.distance
                    }
                    else if (vm.locationSearch.distanceType == 'miles') {
                        distanceKm = (vm.locationSearch.distance * 1.6093)
                    }

                    distanceKm = distanceKm.toFixed(5); //<--Limit decimal places to 5 places to avoid issues with conversions within Azure Search

                    var locationQueryString = "(geo.distance(" + vm.locationSearch.searchFieldName + ", geography'POINT(" + vm.locationSearch.lng + " " + vm.locationSearch.lat + ")') le " + distanceKm + ")"

                    if (vm.filterString == null || vm.filterString == '') {
                        vm.filterString = locationQueryString
                    }
                    else {
                        vm.filterString += " and " + locationQueryString
                    }

                    //ADDITIONAL SORTING VALUE ON DIRECT LOCATION SEARCH
                    //additionalLocationSorting = "geo.distance(location, geography'POINT(" + vm.locationSearch.lng + " " + vm.locationSearch.lat + ")')";

                    //BUILD OUT FILTER UI STRING
                    var filterUiObject = { label: vm.locationSearch.propertyName, values: "Within " + vm.locationSearch.distance + " " + vm.locationSearch.distanceType + " of " + vm.locationSearch.queryLocation };
                    vm.filterStringsArray.push(filterUiObject)
                }
                else {

                    //QUERY BASED ON MAP BOUNDS (Drag/Zoom)
                    var locationQueryString = "(geo.intersects(" + vm.locationSearch.searchFieldName + ", geography'POLYGON((" + vm.locationSearch.bounds + "))'))"

                    if (vm.filterString == null || vm.filterString == '') {
                        vm.filterString = locationQueryString
                    }
                    else {
                        vm.filterString += " and " + locationQueryString
                    }

                    //BUILD OUT FILTER UI STRING
                    var filterUiObject = { label: vm.locationSearch.propertyName, values: "Within map" };
                    vm.filterStringsArray.push(filterUiObject)
                }




            }

            //Debug.trace(vm.filterString);

            // =====================================
            // =====================================


            //If the filter string is empty then just use the categorizations (which MIGHT also be empty)
            if (vm.filterString == null || vm.filterString == '') {
                vm.filterString = vm.categorizationFilterString
            }
            else if (vm.categorizationFilterString != null && vm.categorizationFilterString != '') {
                vm.filterString = "(" + vm.categorizationFilterString + ") and " + vm.filterString;
            }
            else {

            }

            //--- Additional vars for location based sorting (Will be reused by searchMore() method) -----------------------------------------------------------

            vm.locationSort = false;
            vm.locationSortString = null;

            if (vm.locationSearch.available) {

                vm.locationSort = true;

                if (vm.locationSearch.bounds == null) {

                    vm.locationSortString = "geo.distance(" + vm.locationSearch.searchFieldName + ", geography'POINT(" + vm.locationSearch.lng + " " + vm.locationSearch.lat + ")')";
                }
                else if (vm.locationSearch.bounds != null) {
                    //vm.locationSort = false;

                    //Get center lat/long of gmaps bounds:
                    //Debug.trace("center lat/long:" + vm.locationSearch.rawBounds.getCenter());
                    //Debug.trace("center lat:" + vm.locationSearch.rawBounds.getCenter().lat());

                    //If we are using bounds (for drag/zoom map search) then get the center of the bounds object
                    vm.locationSortString = "geo.distance(" + vm.locationSearch.searchFieldName + ", geography'POINT(" + vm.locationSearch.rawBounds.getCenter().lng() + " " + vm.locationSearch.rawBounds.getCenter().lat() + ")')";
                }
            }

            //--------------------------------------------------------------

            //Debug.trace("amount per page:" + vm.amountPerPage);


            searchServices.searchProducts(vm.account.accountNameKey, vm.apiDomain, vm.searchQuery, vm.filterString, vm.searchSorting.orderByString, vm.amountToSkip, vm.amountPerPage, vm.locationSort, vm.locationSortString)
            .success(function (data, status, headers, config) {

                vm.searchQueryCompleted = vm.searchQuery;


                vm.amountToSkip = vm.amountToSkip + vm.amountPerPage;
                vm.resultsAvailable = data.count;
                vm.searching = false;
                vm.searchResults = data.items;


                //Update pagination data --------------------------

                vm.paginationInfo.pageEndAt = vm.paginationInfo.pageStartAt + vm.searchResults.length
                vm.paginationInfo.pageStartAt = 1;
                vm.paginationInfo.lastResultCount = data.items.length;
                //vm.paginationInfo.nextAmountAvailable = 
                //-------------------------------------------------


                if (vm.searchMode == 'map') // || vm.mapUsed)
                {
                    var h = ($(window).height() - mapHeightOffset);
                    document.getElementById('map-results-pane').style.height = h + "px";
                    vm.refreshMapUI();
                }


                // Filter Title Hover String:
                vm.filterTitleString = "";
                for (i = 0; i < vm.filterStringsArray.length; i++) {

                    vm.filterTitleString += vm.filterStringsArray[i].label + ": " + vm.filterStringsArray[i].values;

                    if (i != (vm.filterStringsArray.length - 1)) {
                        vm.filterTitleString += "  |  ";
                    }

                }

            })
            .error(function (data, status, headers, config) {

                vm.searching = false;

            })
        }


        /*=============================================
             Swatch selection methods
        =============================================*/

        vm.selectSwatchFilter = function (parentIndex, childIndex) {
            //Debug.trace("+" + vm.facets[parentIndex].values[childIndex]);
            vm.facets[parentIndex].values[childIndex].Selected = true;
            vm.search();
        }

        vm.deselectSwatchFilter = function (parentIndex, childIndex) {
            //Debug.trace("-" + vm.facets[parentIndex].values[childIndex]);
            vm.facets[parentIndex].values[childIndex].Selected = false;
            vm.search();
        }

        /*====== End Swatch Selection Methods ========*/




        /*=============================================
            Show Advanced selection methods
        =============================================*/

        vm.showAdvancedOptions = function (index) {
            //Debug.trace("+" + vm.facets[index]);
            vm.facets[index].ShowAdvanced = true;
        }

        vm.hideAdvancedOptions = function (index) {
            //Debug.trace("-" + vm.facets[index]);
            vm.facets[index].ShowAdvanced = false;
        }

        /*====== END Show Advanced Selection Methods ========*/




        /*=============================================
             Boolean Operator selection methods
        =============================================*/

        vm.setOperatorToAnd = function (index) {
            //Debug.trace("+" + vm.facets[index]);
            vm.facets[index].BooleanOperator = "and";
            vm.search();
        }

        vm.setOperatorToOr = function (index) {
            //Debug.trace("-" + vm.facets[index]);
            vm.facets[index].BooleanOperator = "or";
            vm.search();
        }

        /*====== END Boolean Operator Selection Methods ========*/






        vm.resetInfiniteScroll = function () {
            //vm.updateInfiniteScrollGlobalState();

            vm.searchingMore = false;
            vm.amountToSkip = 0;
            vm.resultsAvailable = 0;
        }

        $(window).resize(function () {
            vm.updateUIBasedOnWidth();
            //Debug.trace("Handler for .resize() called.");
            //vm.updateInfiniteScrollGlobalState();

            //Update map height if maps used/allowed
            if (vm.searchMode == 'map' && vm.searchResults != null) {
                vm.updateMapHightToFill();
            }

        });

        vm.updateUIBasedOnWidth = function () {

            if ($(window).width() < 990) {
                //Debug.trace("infinite scroll is removed");
                vm.infiniteScroll = false;
                vm.amountPerPage = 6;
            }
            else {
                //Debug.trace("infinite scroll is being used");
                vm.infiniteScroll = true;
                vm.amountPerPage = vm.defaultAmountPerPage;
            }
        }


        $(window).scroll(function () {

            //Debug.trace("window.scrolltop:" + $(window).scrollTop());
            //Debug.trace("window.height:" + $(window).height());
            //Debug.trace("both:" + ($(window).scrollTop() + $(window).height()));
            //Debug.trace("document.height:" + $(document).height());

            if ((($(window).scrollTop() + $(window).height()) + 5) >= $(document).height()) {

                //Debug.trace("Search more");

                if (vm.infiniteScroll) {
                    vm.searchMore('append');
                }

            }
        });

        vm.searchMore = function (mode) {


            if (mode == 'last') {

                //var amountToSubtract = vm.paginationInfo.pageStartAt - ((vm.paginationInfo.pageStartAt - vm.paginationInfo.pageEndAt) + vm.paginationInfo.lastResultCount);

                var newSkipAmount = (vm.paginationInfo.pageStartAt - vm.amountPerPage) - 1;
                //Debug.trace("about to subtract " + vm.amountPerPage + " from " + vm.paginationInfo.pageStartAt);

                vm.amountToSkip = newSkipAmount; //vm.amountToSkip - amountToSubtract;

            }

            if (vm.amountToSkip < vm.resultsAvailable && vm.searchResults != null && vm.searchingMore == false) {
                vm.searchingMore = true;

                //vm.disableInfiniteScroll = true;

                //Debug.trace("Skip:" + vm.amountToSkip + " Amount:" + vm.amountPerPage);

                searchServices.searchProducts(vm.account.accountNameKey, vm.apiDomain, vm.searchQuery, vm.filterString, vm.searchSorting.orderByString, vm.amountToSkip, vm.amountPerPage, vm.locationSort, vm.locationSortString)
                .success(function (data, status, headers, config) {

                    vm.searchQueryCompleted = vm.searchQuery;
                    vm.searchingMore = false;
                    vm.resultsAvailable = data.count;

                    vm.paginationInfo.lastResultCount = data.items.length;

                    if (mode == 'append') {
                        vm.amountToSkip = vm.amountToSkip + data.items.length;

                        //Append the data
                        vm.searchResults = vm.searchResults.concat(data.items); //= .push(data.items);// = [].concat(vm.searchResults, data);
                    }
                    else if (mode == 'next') {
                        //Assign the data
                        vm.searchResults = data.items;

                        vm.amountToSkip = vm.amountToSkip + data.items.length;


                        //Update pagination data --------------------------

                        vm.paginationInfo.pageStartAt = vm.paginationInfo.pageEndAt + 1;
                        vm.paginationInfo.pageEndAt = vm.paginationInfo.pageEndAt + vm.searchResults.length;
                        //vm.paginationInfo.nextAmountAvailable = 

                        //-------------------------------------------------

                    }
                    else if (mode == 'last') {


                        //Assign the data
                        vm.searchResults = data.items;

                        //vm.amountToSkip = vm.amountToSkip - vm.paginationInfo.lastResultCount;

                        //Update pagination data --------------------------                                                
                        vm.paginationInfo.pageStartAt = vm.amountToSkip + 1;
                        vm.paginationInfo.pageEndAt = (vm.paginationInfo.pageStartAt + vm.searchResults.length) - 1;
                        vm.paginationInfo.lastResultCount = vm.amountPerPage; //<--reset

                        vm.amountToSkip = vm.amountToSkip + vm.amountPerPage;

                        //vm.paginationInfo.nextAmountAvailable = 

                        //-------------------------------------------------

                    }



                    if (vm.searchMode == 'map') {
                        vm.refreshMapUI();
                    }

                })
                .error(function (data, status, headers, config) {

                })
            }

        }

        vm.resetSearch = function () {
            vm.searchResults = null;
            vm.searchQuery = null;
            vm.searchQueryCompleted = null
            vm.filterString = null;

            vm.searchingMore = false;
            vm.amountToSkip = 0;
            vm.resultsAvailable = 0;
        }

        /* ==========================================
          Facet UI for Categories
        ==========================================*/

        vm.categoryDrawerOpen = false;

        vm.updateCategoryDrawerUI = function () {
            if (vm.categoryDrawerOpen == false) {
                vm.categoryDrawerOpen = true;
            }
            else {
                vm.categoryDrawerOpen = false;
            }
        }

        /* ==========================================
              Facet UI Dynamic
        ==========================================*/

        vm.updateDrawerUI = function (SearchFieldName, state) {

            if (state == 'closed') {
                $('#filter-' + SearchFieldName + '-closed').show()
                $('#filter-' + SearchFieldName + '-open').hide()
            }
            if (state == 'open') {
                $('#filter-' + SearchFieldName + '-closed').hide()
                $('#filter-' + SearchFieldName + '-open').show()
            }

        }

        /* ==========================================
               Facet Methods
        ==========================================*/

        vm.facets = [];
        vm.locationFacets = [] //<-- stores all location facets for map search initial option(s)
        vm.defaultLocationFacet = null; //<-- Default is 0, can switch if more options available
        vm.updateDefaultLocationFacet = function (locationFacet) {
            vm.defaultLocationFacet = locationFacet
        }



        vm.getSearchFacets = function () {
            searchServices.getFacets(vm.account.accountNameKey, vm.apiDomain)
            .success(function (data, status, headers, config) {

                vm.facets = data.facets;
                vm.pageLoaded = true;

                //Loop through and adjust UI to reflect facet needs:
                for (var i = 0; i < vm.facets.length; i++) {
                    if (vm.facets[i].type == 'location') {

                        //If this is a location property we add extra data types to hold search query and results info-------
                        vm.facets[i]["LocationSearchDistance"] = null;
                        vm.facets[i]["LocationSearchQuery"] = null;
                        vm.facets[i]["FacetIndex"] = i;
                        //vm.facets[i]["LocationSearchQueryResults"] = null;
                        //vm.facets[i]["LocationSearchQuerySuccess"]= null;
                        //vm.facets[i]["HasLocationData"]= false;

                        //For distancetype dls:
                        vm.facets[i]["DistanceTypes"] = [];
                        vm.facets[i]["DistanceTypes"].push({ label: 'Miles', value: 'miles' });
                        vm.facets[i]["DistanceTypes"].push({ label: 'Kilometers', value: 'kilometers' });

                        vm.facets[i]["SelectedDistanceType"] = vm.facets[i].DistanceTypes[0];

                        //The first time we detect ANY location data, we initiate mapping controls---------  
                        if (!vm.mapsInitiated) {

                            vm.mapsInitiated = true;
                            vm.initGoogleMaps();

                            //BUT we also have to make sure that at least ONE featured property WITH location data exists
                            //for(var fp = 0; fp < vm.featuredProperties.length; fp++)
                            //{
                                //if (vm.featuredProperties[f].propertyType == "location")
                                //{
                                    //vm.mapsInitiated = true;
                                    //vm.initGoogleMaps();
                                //}
                            //}

                        }

                        vm.locationFacets.push(vm.facets[i]);
                    }

                    if (vm.locationFacets.length > 0) {
                        vm.defaultLocationFacet = vm.locationFacets[0] //<--We defult to the first one, use switcher if more location properties are available
                    }
                }

                vm.pageLoaded = true;


            })
            .error(function (data, status, headers, config) {
            })
        }

        /*===========================================
          
                FILTER METHODS
          
         ===========================================*/



        /* ==========================================
          Facet UI for Sort UI
        ==========================================*/

        vm.sortingDrawerOpen = false;

        vm.updateSortingDrawerUI = function () {
            if (vm.sortingDrawerOpen == false) {
                vm.sortingDrawerOpen = true;
            }
            else {
                vm.sortingDrawerOpen = false;
            }
        }

        /* ==========================================
               Sort Methods
        ==========================================*/

        vm.sortables = null;
        vm.searchSorting = { orderByString: "relevance", SortLabel: "Relevance" }; //<-- default prior to loading ALL options from API

        vm.getSearchSortables = function () {

            searchServices.getSortables(vm.account.accountNameKey, vm.apiDomain)
            .success(function (data, status, headers, config) {

                vm.sortables = data.sortables;
                vm.searchSorting = data.sortables[0];
            })
            .error(function (data, status, headers, config) {

            })
        }

        vm.updateSorting = function (sortable) {
            vm.searchSorting = sortable;
            vm.search();
        }








        /*===========================================          
                Filter Object         
         ===========================================*/
        //vm.showCategoryUpdateButton = false;

        vm.searchCategorization =
        {
            //ProposedLocation: "(TBD)",

            Category: null,
            Subcategory: null,
            Subsubcategory: null,
            Subsubsubcategory: null,

            //LocationPath: null,

            reset: function () {

                //Debug.trace("reset.");

                //this.LocationPath = null;

                this.Category = null;
                this.Subcategory = null;
                this.Subsubcategory = null;
                this.Subsubsubcategory = null;

                //vm.search();
            },

            updateCategory: function (category) {
                vm.showCategoryUpdateButton = true;
                this.Category = category;

                //vm.searchCategorization.Category = vm.searchCategorization.Category.CategoryNameKey;
                vm.getSubcategories();
                vm.search();
            },
            updateSubcategory: function (subcategory) {
                vm.showCategoryUpdateButton = true;
                this.Subcategory = subcategory;

                //vm.searchCategorization.Subcategory = vm.searchCategorization.Subcategory.SubcategoryNameKey;
                vm.getSubsubcategories();
                vm.search();
            },
            updateSubsubcategory: function (subsubcategory) {
                vm.showCategoryUpdateButton = true;
                this.Subsubcategory = subsubcategory;

                //vm.searchCategorization.Subsubcategory =  + vm.searchCategorization.Subsubcategory.SubsubcategoryNameKey;
                vm.getSubsubsubcategories();
                vm.search();
            },
            updateSubsubsubcategory: function (subsubsubcategory) {
                vm.showCategoryUpdateButton = true;
                this.Subsubsubcategory = subsubsubcategory;
                vm.search();
                //vm.searchCategorization.Subsubsubcategory = vm.searchCategorization.Subsubsubcategory.SubsubsubcategoryNameKey;
            },

        }

        vm.resetCategorizations = function () {
            //vm.showCategoryUpdateButton = true;
            vm.searchCategorization.reset();
            vm.search();
        }

        /*===========================================          
            Filter Categorizations Dropdowns         
        ===========================================*/
        vm.initializeCategorizations = function () {
            //Reset the searchCategorization object:
            vm.searchCategorization.reset();

            //Nullify self and all children
            vm.categories = null;
            vm.subcategories = null;
            vm.subsubcategories = null;
            vm.subsubsubcategories = null;

            //Get category list:
            categoryServices.getCategories(vm.account.accountNameKey, vm.apiDomain)
            .success(function (data, status, headers, config) {
                vm.categories = data.categories;
            })
            .error(function (data, status, headers, config) {
            })
        }


        vm.categories = null;
        vm.subcategories = null;
        vm.subsubcategories = null;
        vm.subsubsubcategories = null;


        vm.getSubcategories = function () {
            //Anything before subcategories is NOT OK for moves
            vm.searchCategorization.Ready = false,

            //Nullify self and all children
            vm.subcategories = null;
            vm.subsubcategories = null;
            vm.subsubsubcategories = null;

            vm.searchCategorization.Subcategory = null;
            vm.searchCategorization.Subsubcategory = null;
            vm.searchCategorization.Subsubsubcategory = null;

            //Get list:
            categoryServices.getCategorization(vm.account.accountNameKey, vm.apiDomain, 'category', vm.searchCategorization.Category.nameKey)
            .success(function (data, status, headers, config) {
                vm.subcategories = data.category.subcategories;

                /*
                var path = vm.product.LocationPath.split("/");
                if (path.length == 2) {
                    //If this product is in a subcategory, remove that subcategory from the list of available move to options:
                    for (var i = 0; i < vm.subcategories.length; i++)
                        if (vm.subcategories[i].SubcategoryNameKey === path[1]) {
                            vm.subcategories.splice(i, 1);
                            break;
                        }
                }*/


            })
            .error(function (data, status, headers, config) {
            })
        }

        vm.getSubsubcategories = function () {

            //Nullify self and all children
            vm.subsubcategories = null;
            vm.subsubsubcategories = null;

            vm.searchCategorization.Subsubcategory = null;
            vm.searchCategorization.Subsubsubcategory = null;

            //Get list:
            categoryServices.getCategorization(vm.account.accountNameKey, vm.apiDomain, 'subcategory', vm.searchCategorization.Category.nameKey + "/" + vm.searchCategorization.Subcategory.nameKey)
            .success(function (data, status, headers, config) {
                vm.subsubcategories = data.subcategory.subsubcategories;

            })
            .error(function (data, status, headers, config) {
            })
        }

        vm.getSubsubsubcategories = function () {

            //Nullify self and all children
            vm.subsubsubcategories = null;

            vm.searchCategorization.Subsubsubcategory = null;

            //Get list:
            categoryServices.getCategorization(vm.account.accountNameKey, vm.apiDomain, 'subsubcategory', vm.searchCategorization.Category.nameKey + "/" + vm.searchCategorization.Subcategory.nameKey + "/" + vm.searchCategorization.Subsubcategory.nameKey)
            .success(function (data, status, headers, config) {
                vm.subsubsubcategories = data.subsubcategory.subsubsubcategories;


            })
            .error(function (data, status, headers, config) {
            })
        }









        /*===============================================


           MAPPING
            CODE


         ===============================================*/



        /*-------------- Initialize Map JS with API Key ------------------*/

        //Used to initiate maps (if account has location based properties)
        vm.initGoogleMaps = function () {
            // Enable the Google Maps JAVASCRIPT API in your Google API account!
            // Enable the Google STATIC Maps API in your Google API account!
            // Enable the Google Maps EMBED API in your Google API account!
            // Enable the Google Maps Geocoding API in your Google API account!
            $.getScript("https://maps.google.com/maps/api/js?v=3.23&key=" + vm.googleMapsApiKey);
            //Debug.trace("Google Maps JS Initialized");   

        }



        vm.refreshMapUI = function () {
            var locationLatLong = { lat: vm.locationSearch.lat, lng: vm.locationSearch.lng };

            if (vm.locationSearch.bounds == null) {
                //Clear existing markers
                //for (var i = 0; i < vm.markersArray.length; i++) {
                //vm.markersArray[i].setMap(null);
                //}
                //vm.markersArray = [];

                map = new google.maps.Map(document.getElementById('google-map'), {
                    zoom: vm.locationSearch.zoom,
                    center: locationLatLong,
                    streetViewControl: false, //<-- Hide street view
                });

                //On drag or zoom we add bounds to locationSearch and make another search request
                google.maps.event.addListener(map, 'dragend', function () {
                    var bounds = map.getBounds();
                    var southWest = bounds.getSouthWest();
                    var northEast = bounds.getNorthEast();
                    //Debug.trace("sw:" + southWest + " ne:" + northEast);

                    vm.locationSearch.rawBounds = bounds; //<--Used for bounds map searches to get center point for sorting / getting next/last results....

                    //the first and last points set must be the same AND the points are listed in the clockwise order to indicate what's "inside" and what's "outside" of the polygon:
                    vm.locationSearch.bounds =
                        southWest.lng() + " " + northEast.lat() + ", " +
                        southWest.lng() + " " + southWest.lat() + ", " +
                        northEast.lng() + " " + southWest.lat() + ", " +
                        northEast.lng() + " " + northEast.lat() + ", " +
                        southWest.lng() + " " + northEast.lat();
                    //Debug.trace(vm.locationSearch.bounds);

                    vm.search();
                });
                google.maps.event.addListener(map, 'zoom_changed', function () {
                    var bounds = map.getBounds();
                    var southWest = bounds.getSouthWest();
                    var northEast = bounds.getNorthEast();
                    //Debug.trace("sw:" + southWest + " ne:" + northEast);

                    vm.locationSearch.rawBounds = bounds; //<--Used for bounds map searches to get center point for sorting / getting next/last results....

                    //the first and last points set must be the same AND the points are listed in the clockwise order to indicate what's "inside" and what's "outside" of the polygon:
                    vm.locationSearch.bounds =
                        southWest.lng() + " " + northEast.lat() + ", " +
                        southWest.lng() + " " + southWest.lat() + ", " +
                        northEast.lng() + " " + southWest.lat() + ", " +
                        northEast.lng() + " " + northEast.lat() + ", " +
                        southWest.lng() + " " + northEast.lat();
                    //Debug.trace(vm.locationSearch.bounds);

                    vm.search();
                });

                //google.maps.event.addListener(map, 'dragend', function () { alert('map dragged'); });
                //google.maps.event.addListener(map, 'idle', function () { alert('map idle'); });           
                //google.maps.event.addListener(map, 'zoom_changed', function () { alert('map zoom changed'); });
                //google.maps.event.addListener(map, 'bounds_changed', function () { alert('map bounds changed'); });                

                vm.setMarkersForResults(); //<--Apply markers for all items in search results

            }
            else {
                //Clear existing markers
                for (var i = 0; i < vm.markersArray.length; i++) {
                    vm.markersArray[i].setMap(null);
                }
                vm.markersArray = [];

                vm.setMarkersForResults(); //<--Apply markers for all items in search results

                //map = new google.maps.Map(document.getElementById('google-map'), {
                //zoom: vm.locationSearch.zoom,
                //streetViewControl: false, //<-- Hide street view
                //});
            }


        }

        /*---------------------------------------------------*/
        vm.updateMapHightToFill = function () {
            //Debug.trace("map height:" + $(window).height());
            var h = ($(window).height() - mapHeightOffset);
            document.getElementById('map-results-pane').style.height = h + "px";
            //google.maps.event.trigger(map, "resize");
            //var map = new google.maps.Map(document.getElementById('google-map'))
            //google.maps.event.trigger(map, 'resize');
        }

        /*---------------   Marker Management   --------------------*/

        vm.markersArray = [];

        vm.setMarkersForResults = function () {
            var searchFieldName = vm.locationSearch.searchFieldName;

            //Debug.trace("length: " + vm.searchResults.length);
            //Debug.trace("document 1 latitude: " + vm.searchResults[0].foundation.Latitude);

            //We create a singlton of the map info window
            var infoWindow = new google.maps.InfoWindow(); //Singleton

            function placeMarker(latLng, title, contentStr) {
                var marker = new google.maps.Marker({
                    position: latLng,
                    map: map,
                    title: title,
                    clickable: true
                });

                vm.markersArray.push(marker);

                console.log("marker set for: " + title);

                marker.setIcon('/Images/ui/map/red-marker.png');
                //marker.setIcon('/Images/ui/map/red-marker.png')
                //marker.setIcon('http://maps.google.com/mapfiles/ms/icons/blue-dot.png')
                //marker.setIcon('http://icons.iconarchive.com/icons/custom-icon-design/pretty-office-8/128/Accept-icon.png');

                google.maps.event.addListener(marker, 'click', function () {
                    infoWindow.close(); // Close previously opened infowindow
                    infoWindow.setContent(contentStr);
                    infoWindow.open(map, marker);
                });
            }

            for (var i = 0; i < vm.searchResults.length; i++) {

                //Debug.trace(vm.searchResults[i][searchFieldName]);

                var locationLatLong = { lat: +vm.searchResults[i][searchFieldName].geospatial.Latitude, lng: +vm.searchResults[i][searchFieldName].geospatial.Longitude };
                var imgUrl = vm.searchResults[i].images.default.thumbnail.url;
                var title = vm.searchResults[i].name;

                if (imgUrl == null || imgUrl == '') {
                    imgUrl = '/Images/ui/fpo/search-thumbnail.jpg'
                }

                var productUrl = '/item/' + vm.searchResults[i].fullyQualifiedName;

                var categoryName = vm.searchResults[i].categoryName;
                var categoryUrl = '/browse/' + vm.searchResults[i].categoryNameKey;

                var subcategoryName = vm.searchResults[i].subcategoryName;
                var subcategoryUrl = '/browse/' + vm.searchResults[i].categoryNameKey + "/" + vm.searchResults[i].subcategoryNameKey;

                var subsubcategoryName = vm.searchResults[i].subsubcategoryName;
                var subsubcategoryUrl = '/browse/' + vm.searchResults[i].categoryNameKey + "/" + vm.searchResults[i].subcategoryNameKey + "/" + vm.searchResults[i].subsubcategoryNameKey;

                var subsubsubcategoryName = vm.searchResults[i].subsubsubcategoryName;
                var subsubsubcategoryUrl = '/browse/' + vm.searchResults[i].categoryNameKey + "/" + vm.searchResults[i].subcategoryNameKey + "/" + vm.searchResults[i].subsubcategoryNameKey + "/" + vm.searchResults[i].subsubsubcategoryNameKey;

                var deeperSubcategoryStrings = "";

                if (subcategoryName != null && subcategoryName != '') {
                    deeperSubcategoryStrings += ' / <a style="color:darkgray" href="' + subcategoryUrl + '" target="_blank">' + subcategoryName + '</a>';
                }
                if (subsubcategoryName != null && subsubcategoryName != '') {
                    deeperSubcategoryStrings += ' / <a style="color:darkgray" href="' + subsubcategoryUrl + '" target="_blank">' + subsubcategoryName + '</a>';
                }
                if (subsubsubcategoryName != null && subsubsubcategoryName != '') {
                    deeperSubcategoryStrings += ' / <a style="color:darkgray" href="' + subsubsubcategoryUrl + '" target="_blank">' + subsubsubcategoryName + '</a>';
                }

                //Featured properties
                var featuredProperties = "";

                //try
                //{

                for (var f = 0; f < vm.featuredProperties.length; f++)
                {
                    if (f <= 2) //<--Top 3
                    {
                        if (vm.searchResults[i][vm.featuredProperties[f].searchField] != null && vm.searchResults[i][vm.featuredProperties[f].searchField] != '') {
                            if (vm.featuredProperties[f].propertyType == 'string') {
                                featuredProperties += "<p style='margin-top:-8px;'><span class='productListingPropertyLabel'>" + vm.featuredProperties[f].propertyName + ":</span>" +
                                     " <span class='productListingPropertyValue'>" + vm.searchResults[i][vm.featuredProperties[f].searchField] + "</span></p>";
                            }
                            else if (vm.featuredProperties[f].propertyType == 'datetime') {
                                featuredProperties += "<p style='margin-top:-8px;'><span class='productListingPropertyLabel'>" + vm.featuredProperties[f].propertyName + ":</span>" +
                                     " <span class='productListingPropertyValue'>" + $filter('date')(vm.searchResults[i][vm.featuredProperties[f].searchField]) + "</span></p>";
                            }

                            else if (vm.featuredProperties[f].propertyType == 'number') {

                                var leading = "";
                                var trailing = "";

                                if (vm.featuredProperties[f].symbol != null) {
                                    if (vm.featuredProperties[f].symbol.placement == 'leading') {
                                        leading = "<span style='margin-right:1.5px'>" + vm.featuredProperties[f].symbol.value + "</span>";
                                    }
                                    else if (vm.featuredProperties[f].symbol.placement == 'trailing') {
                                        trailing = "<span style='margin-left:1.5px'>" + vm.featuredProperties[f].symbol.value + "</span>";
                                    }
                                }

                                featuredProperties += "<p style='margin-top:-8px;'><span class='productListingPropertyLabel'>" + vm.featuredProperties[f].propertyName + ":</span>" +
                                     " <span class='productListingPropertyValue'>" + leading + $filter('number')(vm.searchResults[i][vm.featuredProperties[f].searchField]) + trailing + "</span></p>";
                            }
                            else if (vm.featuredProperties[f].propertyType == 'predefined') {

                                var list = vm.searchResults[i][vm.featuredProperties[f].searchField].join(', ');

                                featuredProperties += "<p style='margin-top:-8px;'><span class='productListingPropertyLabel'>" + vm.featuredProperties[f].propertyName + ":</span>" +
                                     " <span class='productListingPropertyValue'>" + list + "</span></p>";
                            }
                            else if (vm.featuredProperties[f].propertyType == 'swatch') {
                                //var imageLabels = vm.searchResults[i][vm.featuredProperties[f].searchField].join(', ');
                                var imageList = "";

                                if (vm.featuredProperties[f].swatches != null) {
                                    //Debug.trace(vm.searchResults[i][vm.featuredProperties[f].searchField] + " Length=" + vm.searchResults[i][vm.featuredProperties[f].searchField].length);

                                    for (var t = 0; t < vm.searchResults[i][vm.featuredProperties[f].searchField].length; t++) {
                                        //Debug.trace("Testing: " + vm.searchResults[i][vm.featuredProperties[f].searchField][t]);
                                        for (var y = 0; y < vm.featuredProperties[f].swatches.length; y++) {
                                            //Debug.trace(vm.searchResults[i][vm.featuredProperties[f].searchField][t] + "==" + vm.featuredProperties[f].swatches[y].label);
                                            if (vm.searchResults[i][vm.featuredProperties[f].searchField][t] == vm.featuredProperties[f].swatches[y].label) {
                                                var imageList = imageList + "<img style='cursor:pointer; height:13px; width:13px; margin-left:1px; margin-right:2px; margin-top:-2px; border:0px' src='" + vm.featuredProperties[f].swatches[y].imageSmall + "' title='" + vm.featuredProperties[f].swatches[y].label + "' alt='" + vm.featuredProperties[f].swatches[y].label + "' />";
                                            }
                                        }
                                    }
                                }

                                featuredProperties += "<p style='margin-top:-8px;'><span class='productListingPropertyLabel'>" + vm.featuredProperties[f].propertyName + ":</span>" +

                                     " <span class='productListingPropertyValue'>" + imageList + "</span></p>";
                            }
                        }
                    }
                }

                //}
                //catch(ex)
                //{

                //}



                var contentString =
                                    '<div style="width:350px; height:135px">' +

                                    '<div style="float:left; margin-right:10px; margin-top:10px;">' +
                                    '<a href="' + productUrl + '" target="_blank"><img src="' + imgUrl +
                                        '" height="120" width="120" style="border: 1px solid black" onmouseover="this.style.borderColor = \'black\'; this.style.opacity = \'0.85\'" onmouseout="this.style.borderColor = \'black\'; this.style.opacity = \'1\'"></a>' +
                                    '</div>' +

                                    '<div style="float:left; width:220px">' +
                                    '<h4><a class="productTitle" style="color:black" href="' + productUrl + '" target="_blank">' + title + '</a></h5>' +


                                    "<div style='margin-top:17px;'>" + featuredProperties + "<div>" +
                                    

                                    //'<small style="color:darkgray">' +
                                        //'<a style="color:darkgray" href="' + categoryUrl + '" target="_blank">' + categoryName + '</a>' +
                                        //deeperSubcategoryStrings +
                                    //'</small>' +

                                    //'</div>' +

                                    '</div>';

                placeMarker(locationLatLong, title, contentString);

                console.log("marker placed for: " + title);
            }

        }


        /*=================================================
         
          Location Searching
          
         =================================================*/

        /*=============================================
             Location selection methods
        =============================================*/

        vm.locationSearch = {
            available: false,

            propertyName: null,
            searchFieldName: null,

            queryLocation: null,

            distance: null,
            distanceType: null,

            facetIndex: null,

            lat: null,
            lng: null,
            zoom: null,

            bounds: null,
            rawBounds: null,

            Clear: function (index, performSearch) {
                this.available = false;
                this.propertyName = null;
                this.searchFieldName = null;
                this.queryLocation = null;
                this.distance = null;
                this.distanceType = null;
                this.lat = null;
                this.lng = null;
                this.zoom = null;
                this.bounds = null;
                this.rawBounds = null;
                this.facetIndex = null;

                //map = null;

                vm.facets[index].LocationSearchQuery = null;
                vm.facets[index].LocationSearchDistance = null;

                if (performSearch) {
                    vm.search();
                }


                //vm.showMap = false;



            }
        }


        vm.updateLocationPropertyDistanceType = function (index, distanceType) {
            //Debug.trace(index + " " + distanceType.value);
            vm.facets[index].SelectedDistanceType = distanceType;
        }

        //vm.searchLocations = []; //<---Array of searchLocations to use (Add for clients that want to search against multiple locations in a future or custom build)
        // In that scenario we build up an array of object locations, Currently we ONLY allow one search location at a time.



        vm.useSearchLocation = function (index) {

            //When we add a search location we first attempt to get the lat/long from the user input:

            //Debug.trace("+" + vm.facets[index].SearchFieldName);
            var searchField = vm.facets[index].key;
            var propertyName = vm.facets[index].name;
            var locationQuery = vm.facets[index].LocationSearchQuery;
            var locationDistance = vm.facets[index].LocationSearchDistance;
            var distanceType = vm.facets[index].SelectedDistanceType.value;

            if (locationDistance == null || isNaN(locationDistance)) {
                //Debug.trace("Not a number!");
            }
            else {

                locationDistance = locationDistance * 1 //<-- multiply by 1 to add 0 in front of decimals (required for search query)


                //Debug.trace(locationDistance);



                //Debug.trace("searching for '" + locationQuery + "' on " + searchField + " within " + locationDistance + " miles");

                //Attempt to get back a lat/long from Google Maps using the locationQuery:
                var geocoder;
                geocoder = new google.maps.Geocoder();
                geocoder.geocode({
                    'address': locationQuery
                }, function (results, status) {
                    if (status == google.maps.GeocoderStatus.OK) {

                        //Debug.trace(results[0].geometry.location.lat());
                        //Debug.trace(results[0].geometry.location.lng());

                        if (vm.locationSearch.facetIndex != null && vm.locationSearch.facetIndex != index) {
                            //A different location search was done already, clear it out:
                            vm.locationSearch.Clear(vm.locationSearch.facetIndex, false);
                        }

                        vm.locationSearch.facetIndex = index;
                        vm.locationSearch.available = true;
                        vm.locationSearch.bounds = null; //<-- Nullify any bounds data from prioe map drag/zoom searches
                        vm.locationSearch.rawBounds = null; //<-- Nullify any bounds data from prioe map drag/zoom searches
                        vm.locationSearch.distance = locationDistance;
                        vm.locationSearch.propertyName = propertyName;
                        vm.locationSearch.searchFieldName = searchField;
                        vm.locationSearch.queryLocation = locationQuery;
                        vm.locationSearch.lat = results[0].geometry.location.lat();
                        vm.locationSearch.lng = results[0].geometry.location.lng();

                        vm.locationSearch.distanceType = distanceType;

                        //Determine Zoom Level:
                        if (locationDistance >= 0 && locationDistance < .15) {
                            vm.locationSearch.zoom = 18;
                        }
                        else if (locationDistance >= .15 && locationDistance < .5) {
                            vm.locationSearch.zoom = 17;
                        }
                        else if (locationDistance >= .5 && locationDistance < 1) {
                            vm.locationSearch.zoom = 15;
                        }
                        else if (locationDistance >= 1 && locationDistance < 3) {
                            vm.locationSearch.zoom = 14;
                        }
                        else if (locationDistance >= 3 && locationDistance < 5) {
                            vm.locationSearch.zoom = 13;
                        }
                        else if (locationDistance >= 5 && locationDistance < 10) {
                            vm.locationSearch.zoom = 12;
                        }
                        else if (locationDistance >= 10 && locationDistance < 20) {
                            vm.locationSearch.zoom = 11;
                        }
                        else if (locationDistance >= 20 && locationDistance < 40) {
                            vm.locationSearch.zoom = 10;
                        }
                        else if (locationDistance >= 40 && locationDistance < 60) {
                            vm.locationSearch.zoom = 9;
                        }
                        else if (locationDistance >= 60 && locationDistance < 120) {
                            vm.locationSearch.zoom = 8;
                        }
                        else if (locationDistance >= 120 && locationDistance < 250) {
                            vm.locationSearch.zoom = 7;
                        }
                        else if (locationDistance >= 250 && locationDistance < 500) {
                            vm.locationSearch.zoom = 6;
                        }
                        else if (locationDistance >= 500 && locationDistance < 800) {
                            vm.locationSearch.zoom = 4;
                        }
                        else {
                            vm.locationSearch.zoom = 3;
                        }

                        vm.search();

                    }
                });

            }


        }


        /*===============================================

           END MAPPING CODE
        
         ===============================================*/























        /* ==========================================
               SEARCH OLD
           ==========================================

        vm.facets = [];
        vm.sortables = [];

        vm.searchQuery = null;
        vm.filterString = null;

        vm.initialLoad = true;
        vm.query = "";
        vm.filter = "";
        vm.orderBy = "relevance";
        vm.skip = 0;
        vm.take = 60;

        vm.featuredProducts = null;
        vm.products = [];

        vm.search = function () {

            searchServices.searchProducts(vm.account.accountNameKey, vm.apiDomain, vm.query, vm.filter, vm.orderBy, vm.skip, vm.take)
            .success(function (data, status, headers, config) {

                if (vm.initialLoad)
                {
                    vm.featuredProducts = data.products;

                    vm.initialLoad = false;
                    //search again, not enough Featured products
                    vm.filter = "";
                    vm.searchProducts();
                }
                else {
                    vm.products[0] = data.products;                   
                }

            })
            .error(function (data, status, headers, config) {

            })
        }*/



        /* ==========================================
               CONTROLLER ACTIVATION
           ==========================================*/

        activate();

        function activate(){

            vm.accountNameKey = AccountNameKey;
            vm.apiDomain = ApiDomain;
            vm.googleMapsApiKey = JSON.parse(CoreServiceSettings_GoogleMapsApiKey);


            vm.getAccountSettings();
            $(".nano").nanoScroller();
    

        }

    }

})();


















