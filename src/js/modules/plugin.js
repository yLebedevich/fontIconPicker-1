/**
 * fontIconPicker Plugin Class
 */

import $ from 'jquery';
import defaults from './defaults.js';

'use strict';

function FontIconPicker( element, options ) {
	this.element = $( element );
	this.settings = $.extend( {}, defaults, options );
	if ( this.settings.emptyIcon ) {
		this.settings.iconsPerPage--;
	}
	this.iconPicker = $( '<div/>', {
		class : 'icons-selector',
		style : 'position: relative',
		html  : '<div class="selector">' +
						'<span class="selected-icon">' +
							'<i class="fip-icon-block"></i>' +
						'</span>' +
						'<span class="selector-button">' +
							'<i class="fip-icon-down-dir"></i>' +
						'</span>' +
					 '</div>' +
					 '<div class="selector-popup-wrap">' +
						 '<div class="selector-popup" style="display: none;">' + ( ( this.settings.hasSearch ) ?
							 '<div class="selector-search">' +
								 '<input type="text" name="" value="" placeholder="Search icon" class="icons-search-input"/>' +
								 '<i class="fip-icon-search"></i>' +
							 '</div>' : '' ) +
							 '<div class="selector-category">' +
								 '<select name="" class="icon-category-select" style="display: none">' +
								 '</select>' +
							 '</div>' +
							 '<div class="fip-icons-container"></div>' +
							 '<div class="selector-footer" style="display:none;">' +
								 '<span class="selector-pages">1/2</span>' +
								 '<span class="selector-arrows">' +
									 '<span class="selector-arrow-left" style="display:none;">' +
										 '<i class="fip-icon-left-dir"></i>' +
									 '</span>' +
									 '<span class="selector-arrow-right">' +
										 '<i class="fip-icon-right-dir"></i>' +
									 '</span>' +
								 '</span>' +
							 '</div>' +
						 '</div>' +
					 '</div>'
	} );
	this.iconContainer = this.iconPicker.find( '.fip-icons-container' );
	this.searchIcon = this.iconPicker.find( '.selector-search i' );
	this.selectorPopup = this.iconPicker.find( '.selector-popup-wrap' );
	this.iconsSearched = [];
	this.isSearch = false;
	this.totalPage = 1;
	this.currentPage = 1;
	this.currentIcon = false;
	this.iconsCount = 0;
	this.open = false;

	// Set the default values for the search related variables
	this.searchValues = [];
	this.availableCategoriesSearch = [];

	// The trigger event for change
	this.triggerEvent = null;

	// Backups
	this.backupSource = [];
	this.backupSearch = [];

	// Set the default values of the category related variables
	this.isCategorized = false; // Automatically detects if the icon listing is categorized
	this.selectCategory = this.iconPicker.find( '.icon-category-select' ); // The category SELECT input field
	this.selectedCategory = false; // false means all categories are selected
	this.availableCategories = []; // Available categories, it is a two dimensional array which holds categorized icons
	this.unCategorizedKey = null; // Key of the uncategorized category

	// Initialize plugin
	this.init();
}

FontIconPicker.prototype = {
	/**
	 * Init
	 */
	init: function () {

		// Add the theme CSS to the iconPicker
		this.iconPicker.addClass(this.settings.theme);

		// To properly calculate iconPicker height and width
		// We will first append it to body (with left: -9999px so that it is not visible)
		this.iconPicker.css({
			left: -9999
		}).appendTo('body');
		var iconPickerHeight = this.iconPicker.outerHeight(),
		iconPickerWidth = this.iconPicker.outerWidth();

		// Now reset the iconPicker CSS
		this.iconPicker.css({
			left: ''
		});

		// Add the icon picker after the select
		this.element.before(this.iconPicker);


		// Hide source element
		// Instead of doing a display:none, we would rather
		// make the element invisible
		// and adjust the margin
		this.element.css({
			visibility: 'hidden',
			top: 0,
			position: 'relative',
			zIndex: '-1',
			left: '-' + iconPickerWidth + 'px',
			display: 'inline-block',
			height: iconPickerHeight + 'px',
			width: iconPickerWidth + 'px',
			// Reset all margin, border and padding
			padding: '0',
			margin: '0 -' + iconPickerWidth + 'px 0 0', // Left margin adjustment to account for dangling space
			border: '0 none',
			verticalAlign: 'top',
			float: 'none' // Fixes positioning with floated elements
		});

		// Set the trigger event
		if ( ! this.element.is('select') ) {
			// Determine the event that is fired when user change the field value
			// Most modern browsers supports input event except IE 7, 8.
			// IE 9 supports input event but the event is still not fired if I press the backspace key.
			// Get IE version
			// https://gist.github.com/padolsey/527683/#comment-7595
			var ieVersion = (function() {
				var v = 3, div = document.createElement('div'), a = div.all || [];
				while (div.innerHTML = '<!--[if gt IE '+(++v)+']><br><![endif]-->', a[0]);
				return v > 4 ? v : !v;
			}());
			var el = document.createElement('div');
			this.triggerEvent = (ieVersion === 9 || !('oninput' in el)) ? ['keyup'] : ['input', 'keyup']; // Let's keep the keyup event for scripts that listens to it
		}

		// If current element is SELECT populate settings.source
		if (!this.settings.source && this.element.is('select')) {
			// Reset the source and searchSource
			// These will be populated according to the available options
			this.settings.source = [];
			this.settings.searchSource = [];

			// Check if optgroup is present within the select
			// If it is present then the source has to be grouped
			if ( this.element.find('optgroup').length ) {
				// Set the categorized to true
				this.isCategorized = true;
				this.element.find('optgroup').each($.proxy(function(i, el) {
					// Get the key of the new category array
					var thisCategoryKey = this.availableCategories.length,
					// Create the new option for the selectCategory SELECT field
					categoryOption = $('<option />');

					// Set the value to this categorykey
					categoryOption.attr('value', thisCategoryKey);
					// Set the label
					categoryOption.html($(el).attr('label'));

					// Append to the DOM
					this.selectCategory.append(categoryOption);

					// Init the availableCategories array
					this.availableCategories[thisCategoryKey] = [];
					this.availableCategoriesSearch[thisCategoryKey] = [];

					// Now loop through it's option elements and add the icons
					$(el).find('option').each($.proxy(function(i, cel) {
						var newIconValue = $(cel).val(),
						newIconLabel = $(cel).html();

						// Check if the option element has value and this value does not equal to the empty value
						if (newIconValue && newIconValue !== this.settings.emptyIconValue) {
							// Push to the source, because at first all icons are selected
							this.settings.source.push(newIconValue);

							// Push to the availableCategories child array
							this.availableCategories[thisCategoryKey].push(newIconValue);

							// Push to the search values
							this.searchValues.push(newIconLabel);
							this.availableCategoriesSearch[thisCategoryKey].push(newIconLabel);
						}
					}, this));
				}, this));

				// Additionally check for any first label option child
				if ( this.element.find('> option').length ) {
					this.element.find('> option').each($.proxy(function(i, el) {
						var newIconValue = $(el).val(),
						newIconLabel = $(el).html();

						// Don't do anything if the new icon value is empty
						if ( !newIconValue || newIconValue === '' || newIconValue == this.settings.emptyIconValue ) {
							return true;
						}

						// Set the uncategorized key if not set already
						if ( this.unCategorizedKey === null ) {
							this.unCategorizedKey = this.availableCategories.length;
							this.availableCategories[this.unCategorizedKey] = [];
							this.availableCategoriesSearch[this.unCategorizedKey] = [];
							// Create an option and append to the category selector
							$('<option />').attr('value', this.unCategorizedKey).html(this.settings.unCategorizedText).appendTo(this.selectCategory);
						}

						// Push the icon to the category
						this.settings.source.push(newIconValue);
						this.availableCategories[this.unCategorizedKey].push(newIconValue);

						// Push the icon to the search
						this.searchValues.push(newIconLabel);
						this.availableCategoriesSearch[this.unCategorizedKey].push(newIconLabel);
					}, this));
				}
			// Not categorized
			} else {
				this.element.find('option').each($.proxy(function (i, el) {
					var newIconValue = $(el).val(),
					newIconLabel = $(el).html();
					if (newIconValue) {
						this.settings.source.push(newIconValue);
						this.searchValues.push(newIconLabel);
					}
				}, this));
			}

			// Clone and backup the original source and search
			this.backupSource = this.settings.source.slice(0);
			this.backupSearch = this.searchValues.slice(0);

			// load the categories
			this.loadCategories();
		// Normalize the given source
		} else {
			this.initSourceIndex();
			// No need to call loadCategories or take backups because these are called from the initSourceIndex
		}

		// Load icons
		this.loadIcons();

		/**
		 * On down arrow click
		 */
		this.iconPicker.find('.selector-button').click($.proxy(function (event) {
			// Stop event propagation for self closing
			event.stopPropagation();

			// Open/Close the icon picker
			this.toggleIconSelector();

		}, this));

		// Since the popup can be appended anywhere
		// We will add the event listener to the popup
		// And will stop the eventPropagation on click
		// @since v2.1.0

		/**
		 * Category changer
		 */
		this.selectorPopup.on('change keyup', '.icon-category-select', $.proxy(function(e) {
			// Don't do anything if not categorized
			if ( this.isCategorized === false ) {
				return false;
			}
			var targetSelect = $(e.currentTarget),
			currentCategory = targetSelect.val();
			// Check if all categories are selected
			if (targetSelect.val() === 'all') {
				// Restore from the backups
				// @note These backups must be rebuild on source change, otherwise it will lead to error
				this.settings.source = this.backupSource;
				this.searchValues = this.backupSearch;
			// No? So there is a specified category
			} else {
				var key = parseInt(currentCategory, 10);
				if (this.availableCategories[key]) {
					this.settings.source = this.availableCategories[key];
					this.searchValues = this.availableCategoriesSearch[key];
				}
			}
			this.resetSearch();
			this.loadIcons();
		}, this));

		/**
		 * Next page
		 */
		this.selectorPopup.on('click', '.selector-arrow-right', $.proxy(function (e) {
			if (this.currentPage < this.totalPage) {
				this.currentPage = this.currentPage + 1;
				this.renderIconContainer();
			}
		}, this));

		/**
		 * Prev page
		 */
		this.selectorPopup.on('click', '.selector-arrow-left', $.proxy(function (e) {
			if (this.currentPage > 1) {
				this.currentPage = this.currentPage - 1;
				this.renderIconContainer();
			}
		}, this));

		/**
		 * Realtime Icon Search
		 */
		this.selectorPopup.on('keyup', '.icons-search-input', $.proxy(function (e) {

			// Get the search string
			var searchString = $(e.currentTarget).val();

			// If the string is not empty
			if (searchString === '') {
				this.resetSearch();
				return;
			}

			// Set icon search to X to reset search
			this.searchIcon.removeClass('fip-icon-search');
			this.searchIcon.addClass('fip-icon-cancel');

			// Set this as a search
			this.isSearch = true;

			// Reset current page
			this.currentPage = 1;

			// Actual search
			// This has been modified to search the searchValues instead
			// Then return the value from the source if match is found
			this.iconsSearched = [];
			$.grep(this.searchValues, $.proxy(function (n, i) {
				if (n.toLowerCase().search(searchString.toLowerCase()) >= 0) {
					this.iconsSearched[this.iconsSearched.length] = this.settings.source[i];
					return true;
				}
			}, this));

			// Render icon list
			this.renderIconContainer();
		}, this));

		/**
		 * Quit search
		 */
		// Quit search happens only if clicked on the cancel button
		this.selectorPopup.on('click', '.selector-search .fip-icon-cancel', $.proxy(function () {
			this.selectorPopup.find('.icons-search-input').focus();
			this.resetSearch();
		}, this));

		/**
		 * On icon selected
		 */
		this.selectorPopup.on('click', '.fip-box', $.proxy(function (e) {
			this.setSelectedIcon($(e.currentTarget).find('i').attr('data-fip-value'));
			this.toggleIconSelector();
		}, this));

		/**
		 * Stop click propagation on iconpicker
		 */
		this.selectorPopup.click(function (event) {
			event.stopPropagation();
			return false;
		});

		/**
		 * On click out
		 * Add the functionality #9
		 * {@link https://github.com/micc83/fontIconPicker/issues/9}
		 */
		if ( this.settings.autoClose ) {
			$('html').click($.proxy(function () {
				if (this.open) {
					this.toggleIconSelector();
				}
			}, this));
		}

	},



	/**
	 * Init the source & search index from the current settings
	 * @return {void}
	 */
	initSourceIndex: function() {
		// First check for any sorts of errors
		if ( typeof(this.settings.source) !== 'object' ) {
			return;
		}

		// We are going to check if the passed source is an array or an object
		// If it is an array, then don't do anything
		// otherwise it has to be an object and therefore is it a categorized icon set
		if ($.isArray(this.settings.source)) {
			// This is not categorized since it is 1D array
			this.isCategorized = false;
			this.selectCategory.html('').hide();

			// We are going to convert the source items to string
			// This is necessary because passed source might not be "strings" for attribute related icons
			this.settings.source = $.map(this.settings.source, function(e, i) {
				if ( typeof(e.toString) == 'function' ) {
					return e.toString();
				} else {
					return e;
				}
			});

			// Now update the search
			// First check if the search is given by user
			if ( $.isArray(this.settings.searchSource) ) {
				// Convert everything inside the searchSource to string
				this.searchValues = $.map(this.settings.searchSource, function(e, i) {
					if ( typeof(e.toString) == 'function' ) {
						return e.toString();
					} else {
						return e;
					}
				}); // Clone the searchSource
			// Not given so use the source instead
			} else {
				this.searchValues = this.settings.source.slice(0); // Clone the source
			}
		// Categorized icon set
		} else {
			var originalSource = $.extend(true, {}, this.settings.source);

			// Reset the source
			this.settings.source = [];

			// Reset other variables
			this.searchValues = [];
			this.availableCategoriesSearch = [];
			this.selectedCategory = false;
			this.availableCategories = [];
			this.unCategorizedKey = null;

			// Set the categorized to true and reset the HTML
			this.isCategorized = true;
			this.selectCategory.html('');

			// Now loop through the source and add to the list
			for (var categoryLabel in originalSource) {
				// Get the key of the new category array
				var thisCategoryKey = this.availableCategories.length,
				// Create the new option for the selectCategory SELECT field
				categoryOption = $('<option />');

				// Set the value to this categorykey
				categoryOption.attr('value', thisCategoryKey);
				// Set the label
				categoryOption.html(categoryLabel);

				// Append to the DOM
				this.selectCategory.append(categoryOption);

				// Init the availableCategories array
				this.availableCategories[thisCategoryKey] = [];
				this.availableCategoriesSearch[thisCategoryKey] = [];

				// Now loop through it's icons and add to the list
				for ( var newIconKey in originalSource[categoryLabel] ) {
					// Get the new icon value
					var newIconValue = originalSource[categoryLabel][newIconKey];
					// Get the label either from the searchSource if set, otherwise from the source itself
					var newIconLabel = (this.settings.searchSource && this.settings.searchSource[categoryLabel] && this.settings.searchSource[categoryLabel][newIconKey]) ?
										this.settings.searchSource[categoryLabel][newIconKey] : newIconValue;

					// Try to convert to the source value string
					// This is to avoid attribute related icon sets
					// Where hexadecimal or decimal numbers might be passed
					if ( typeof(newIconValue.toString) == 'function' ) {
						newIconValue = newIconValue.toString();
					}
					// Check if the option element has value and this value does not equal to the empty value
					if (newIconValue && newIconValue !== this.settings.emptyIconValue) {
						// Push to the source, because at first all icons are selected
						this.settings.source.push(newIconValue);

						// Push to the availableCategories child array
						this.availableCategories[thisCategoryKey].push(newIconValue);

						// Push to the search values
						this.searchValues.push(newIconLabel);
						this.availableCategoriesSearch[thisCategoryKey].push(newIconLabel);
					}
				}
			}
		}

		// Clone and backup the original source and search
		this.backupSource = this.settings.source.slice(0);
		this.backupSearch = this.searchValues.slice(0);

		// Call the loadCategories
		this.loadCategories();
	},

	/**
	 * Load Categories
	 * @return {void}
	 */
	loadCategories: function() {
		// Dont do anything if it is not categorized
		if ( this.isCategorized === false ) {
			return;
		}

		// Now append all to the category selector
		$('<option value="all">' + this.settings.allCategoryText + '</option>').prependTo(this.selectCategory);

		// Show it and set default value to all categories
		this.selectCategory.show().val('all').trigger('change');
	},

	/**
	 * Load icons
	 */
	loadIcons: function () {
		// Set the content of the popup as loading
		this.iconContainer.html('<i class="fip-icon-spin3 animate-spin loading"></i>');

		// If source is set
		if (this.settings.source instanceof Array) {
			// Render icons
			this.renderIconContainer();
		}
	},

	iconGenerator: function(item) {
		if (this.settings.iconGenerator) {
			return this.settings.iconGenerator(item);
		}
		return '<i data-fip-value="' + item + '" ' + (this.settings.useAttribute ? (this.settings.attributeName + '="' + ( this.settings.convertToHex ? '&#x' + parseInt(item, 10).toString(16) + ';' : item ) + '"') : 'class="' + item + '"') + '></i>';
	},

	/**
	 * Render icons inside the popup
	 */
	renderIconContainer: function () {

		var offset, iconsPaged = [], footerTotalIcons;

		// Set a temporary array for icons
		if (this.isSearch) {
			iconsPaged = this.iconsSearched;
		} else {
			iconsPaged = this.settings.source;
		}

		// Count elements
		this.iconsCount = iconsPaged.length;

		// Calculate total page number
		this.totalPage = Math.ceil(this.iconsCount / this.settings.iconsPerPage);

		// Hide footer if no pagination is needed
		if (this.totalPage > 1) {
			this.selectorPopup.find('.selector-footer').show();
			// Reset the pager buttons
			// Fix #8 {@link https://github.com/micc83/fontIconPicker/issues/8}
			// It is better to set/hide the pager button here
			// instead of all other functions that calls back renderIconContainer
			if ( this.currentPage < this.totalPage ) { // current page is less than total, so show the arrow right
				this.selectorPopup.find('.selector-arrow-right').show();
			} else { // else hide it
				this.selectorPopup.find('.selector-arrow-right').hide();
			}
			if ( this.currentPage > 1 ) { // current page is greater than one, so show the arrow left
				this.selectorPopup.find('.selector-arrow-left').show();
			} else { // else hide it
				this.selectorPopup.find('.selector-arrow-left').hide();
			}
		} else {
			this.selectorPopup.find('.selector-footer').hide();
		}

		// Set the text for page number index and total icons
		this.selectorPopup.find('.selector-pages').html(this.currentPage + '/' + this.totalPage + ' <em>(' + this.iconsCount + ')</em>');

		// Set the offset for slice
		offset = (this.currentPage - 1) * this.settings.iconsPerPage;

		// Should empty icon be shown?
		if (this.settings.emptyIcon) {
			// Reset icon container HTML and prepend empty icon
			this.iconContainer.html('<span class="fip-box"><i class="fip-icon-block" data-fip-value="fip-icon-block"></i></span>');

		// If not show an error when no icons are found
		} else if (iconsPaged.length < 1) {
			this.iconContainer.html('<span class="icons-picker-error"><i class="fip-icon-block" data-fip-value="fip-icon-block"></i></span>');
			return;

		// else empty the container
		} else {
			this.iconContainer.html('');
		}

		// Set an array of current page icons
		iconsPaged = iconsPaged.slice(offset, offset + this.settings.iconsPerPage);

		// List icons
		for (var i = 0, item; item = iconsPaged[i++];) {
			// Set the icon title
			var flipBoxTitle = item;
			$.grep(this.settings.source, $.proxy(function(e, i) {
				if ( e === item ) {
					flipBoxTitle =  this.searchValues[i];
					return true;
				}
				return false;
			}, this));

			// Set the icon box
			$('<span/>', {
				html:      this.iconGenerator(item),
				'class':   'fip-box',
				title: flipBoxTitle
			}).appendTo(this.iconContainer);
		}

		// If no empty icon is allowed and no current value is set or current value is not inside the icon set
		if (!this.settings.emptyIcon && (!this.element.val() || $.inArray(this.element.val(), this.settings.source) === -1)) {

			// Get the first icon
			this.setSelectedIcon(iconsPaged[0]);

		} else if ( $.inArray(this.element.val(), this.settings.source) === -1 ) {
			// Issue #7
			// Need to pass empty string
			// Set empty
			// Otherwise DOM will be set to null value
			// which would break the initial select value
			this.setSelectedIcon('');

		} else {
			// Fix issue #7
			// The trick is to check the element value
			// Internally fip-icon-block must be used for empty values
			// So if element.val == emptyIconValue then pass fip-icon-block
			var passDefaultIcon = this.element.val();
			if ( passDefaultIcon === this.settings.emptyIconValue ) {
				passDefaultIcon = 'fip-icon-block';
			}
			// Set the default selected icon even if not set
			this.setSelectedIcon(passDefaultIcon);
		}

	},

	/**
	 * Set Highlighted icon
	 */
	setHighlightedIcon: function () {
		this.iconContainer.find('.current-icon').removeClass('current-icon');
		if (this.currentIcon) {
			this.iconContainer.find('[data-fip-value="' + this.currentIcon + '"]').parent('span').addClass('current-icon');
		}
	},

	/**
	 * Set selected icon
	 *
	 * @param {string} theIcon
	 */
	setSelectedIcon: function (theIcon) {
		if (theIcon === 'fip-icon-block') {
			theIcon = '';
		}

		// Check if attribute is to be used
		if ( this.settings.useAttribute ) {
			if ( theIcon ) {
				this.iconPicker.find('.selected-icon').html('<i ' + this.settings.attributeName + '="' + ( this.settings.convertToHex ? '&#x' + parseInt(theIcon, 10).toString(16) + ';' : theIcon ) + '"></i>' );
			} else {
				this.iconPicker.find('.selected-icon').html('<i class="fip-icon-block"></i>');
			}
		// Use class
		} else {
			this.iconPicker.find('.selected-icon').html('<i class="' + (theIcon || 'fip-icon-block') + '"></i>');
		}
		// Set the value of the element and trigger change event
		this.element.val((theIcon === '' ? this.settings.emptyIconValue : theIcon )).trigger('change');
		if ( this.triggerEvent !== null ) {
			// Trigger other events
			for ( var eventKey in this.triggerEvent ) {
				this.element.trigger(this.triggerEvent[eventKey]);
			}
		}
		this.currentIcon = theIcon;
		this.setHighlightedIcon();
	},

	/**
	 * Recalculate the position of the Popup
	 */
	repositionIconSelector: function() {
		// Calculate the position + width
		var offset = this.iconPicker.offset(),
		offsetTop = offset.top + this.iconPicker.outerHeight(true),
		offsetLeft = offset.left;

		this.selectorPopup.css({
			left: offsetLeft,
			top: offsetTop
		});
	},

	/**
	 * Open/close popup (toggle)
	 */
	toggleIconSelector: function () {
		this.open = (!this.open) ? 1 : 0;

		$(window).off('resize.fonticonpicker');
		this.selectorPopup.find('.selector-popup').off('clickoutside touchendoutside');

		// Append the popup if needed
		if ( this.open ) {
			// Check the origin
			if ( this.settings.appendTo !== 'self' ) {
				// Append to the selector and set the CSS + theme
				this.selectorPopup.appendTo( this.settings.appendTo ).css({
					zIndex: 1000 // Let's decrease the zIndex to something reasonable
				}).addClass('icons-selector ' + this.settings.theme );

				// call resize()
				this.repositionIconSelector();

				// resize on window resize
				$(window).on('resize.fonticonpicker', $.proxy(function() {
					this.repositionIconSelector();
				}, this));
			}

			// Adjust the offsetLeft
			// Resolves issue #10
			// @link https://github.com/micc83/fontIconPicker/issues/10
			this.selectorPopup.find('.selector-popup').show();
			var popupWidth = this.selectorPopup.width(),
			windowWidth = $(window).width(),
			popupOffsetLeft = this.selectorPopup.offset().left,
			containerOffset = ( this.settings.appendTo == 'self' ? this.selectorPopup.parent().offset() : $( this.settings.appendTo ).offset() );
			this.selectorPopup.find('.selector-popup').hide();
			if ( popupOffsetLeft + popupWidth > windowWidth - 20 /* 20px adjustment for better appearance */ ) {
				this.selectorPopup.css({
					left: windowWidth - 20 - popupWidth - containerOffset.left
				});
			}

			if ( this.settings.autoClose ) {
				this.selectorPopup.find('.selector-popup').on('clickoutside touchendoutside', $.proxy(function () {
					if (this.open) {
						this.toggleIconSelector();
					}
				}, this));
			}
		}
		this.selectorPopup.find('.selector-popup').slideToggle(300, $.proxy(function() {
			this.iconPicker.find('.selector-button i').toggleClass('fip-icon-down-dir');
			this.iconPicker.find('.selector-button i').toggleClass('fip-icon-up-dir');
			if (this.open) {
				this.selectorPopup.find('.icons-search-input').focus().select();
			} else {
				// append and revert to the original position and reset theme
				this.selectorPopup.appendTo( this.iconPicker ).css({
					left: '',
					top: '',
					zIndex: ''
				}).removeClass('icons-selector ' + this.settings.theme );
			}
		}, this));
	},

	/**
	 * Reset search
	 */
	resetSearch: function () {
		// Empty input
		this.selectorPopup.find('.icons-search-input').val('');

		// Reset search icon class
		this.searchIcon.removeClass('fip-icon-cancel');
		this.searchIcon.addClass('fip-icon-search');

		// Go back to page 1
		this.currentPage = 1;
		this.isSearch = false;

		// Rerender icons
		this.renderIconContainer();
	}
};

// ES6 Export it as module
export { FontIconPicker };