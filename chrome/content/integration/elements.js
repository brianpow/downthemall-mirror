/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is DownThemAll!
 *
 * The Initial Developers of the Original Code are Stefano Verna and Federico Parodi
 * Portions created by the Initial Developers are Copyright (C) 2004-2007
 * the Initial Developers. All Rights Reserved.
 *
 * Contributor(s):
 *    Stefano Verna
 *    Federico Parodi <f.parodi@tiscali.it>
 *    Nils Maier <MaierMan@web.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
 
var DTA_Prompts = {};
Components.utils.import('resource://dta/prompts.jsm', DTA_Prompts);
 
// DTA context overlay
var DTA_ContextOverlay = {

	_str: Components.classes['@mozilla.org/intl/stringbundle;1']
		.getService(Components.interfaces.nsIStringBundleService)
		.createBundle('chrome://dta/locale/menu.properties'),
	
	getString: function(n) {
		try {
			return this._str.GetStringFromName(n);
		} catch (ex) {
			DTA_debug.log("locale error: " + n, ex);
			return '<error>';
		}
	},
	
	trim: function(t) {
		return t.replace(/^[ \t_]+|[ \t_]+$/gi, '').replace(/(_){2,}/g, "_");
	},
	
	addLinksToArray: function(lnks, urls, doc) {
		if (!lnks || !lnks.length) {
			return;
		}
		
		let ref = DTA_AddingFunctions.getRef(doc);
		
		for (var i = 0; i < lnks.length; ++i) {
			// remove anchor from url
			var link = lnks[i];
			// if it's valid and it's new
			if (!DTA_AddingFunctions.isLinkOpenable(link.href)) {
				continue;
			}
				
			/// XXX: title is also parsed by extractDescription
			/// XXX: is this instance necessary?
			var udesc = '';
			if (link.hasAttribute('title')) {
				udesc = this.trim(link.getAttribute('title'));
			}
			let url = DTA_AddingFunctions.ios.newURI(link.href, doc.characterSet, null);
			urls.push({
				'url': new DTA_URL(url),
				'referrer': ref,
				'description': this.extractDescription(link),
				'ultDescription': udesc
			});
			
			var ml = DTA_getLinkPrintMetalink(url.ref);
			if (ml) {
				urls.push({
					'url': new DTA_URL(ml),
					'referrer': ref,
					'description': '[metalink] http://www.metalinker.org/',
					'ultDescription': '',
					'metalink': true
				});
			}
		}
	},
	
	addImagesToArray: function(lnks, images, doc)	{
		if (!lnks || !lnks.length) {
			return;
		}
		
		var ref = DTA_AddingFunctions.getRef(doc);

		for (var i = 0; i < lnks.length; ++i) {
			var src = lnks[i].src;
			try {
				src = DTA_AddingFunctions.composeURL(doc, src);
			}
			catch (ex) {
				DTA_debug.log("failed to compose: " + src, ex);
				continue;
			}
			// if it's valid and it's new
			// better double check :p
			if (!DTA_AddingFunctions.isLinkOpenable(src)) {
				continue;
			}
			var desc = '';
			if (lnks[i].hasAttribute('alt')) {
				desc = this.trim(lnks[i].getAttribute('alt'));
			}
			else if (lnks[i].hasAttribute('title')) {
				desc = this.trim(lnks[i].getAttribute('title'));
			}
			images.push({
				'url': new DTA_URL(src),
				'referrer': ref,
				'description': desc
			});
		}
	},
	
	// recursively add stuff.
	addLinks: function(aWin, aURLs, aImages, honorSelection) {

		function filterElements(nodes, set) {
			var filtered = [];
			for (var i = 0, e = nodes.length; i < e; ++i) {
				if (set.containsNode(nodes[i], true)) {
					filtered.push(nodes[i]);
				}
			}
			return filtered;
		}
	
		try {
		 
			var links = aWin.document.links;
			var images = aWin.document.images;
			var embeds = aWin.document.embeds;
			var rawInputs = aWin.document.getElementsByTagName('input');
			var inputs = [];
			for (var i = 0; i < rawInputs.length; ++i) {
				var rit = rawInputs[i].getAttribute('type');
				if (!rit || rit.toLowerCase() != 'image') {
					continue;
				}
				inputs.push(rawInputs[i]);
			}
			
			var sel = aWin.getSelection();
			if (honorSelection && sel && !sel.isCollapsed) {
				DTA_debug.logString("selection only");
				[links, images, embeds, inputs] = [links, images, embeds, inputs].map(
					function(e) {
						return filterElements(e, sel);
					}
				);
			}
			else {
				// we were asked to honor the selection, but we didn't actually have one.
				// so reset this flag so that we can continue processing frames below.
				honorSelection = false;
			}
			
			this.addLinksToArray(links, aURLs, aWin.document);
			[images, embeds, inputs].forEach(
				function(e) {
					this.addImagesToArray(e, aImages, aWin.document);
				},
				this
			);
		}
		catch (ex) {
			DTA_debug.log('addLinks', ex);
		}
		
		// do not process further as we just filtered the selection
		if (honorSelection) {
			return;
		}
		
		// recursively process any frames
		if (aWin.frames) {
			for (var i = 0, e = aWin.frames.length; i < e; ++i) {
				this.addLinks(aWin.frames[i], aURLs, aImages);
			}
		}
	},
	
	findWindowsNavigator: function(all) {
		var windows = [];
		if (!all) {
			var sel = document.commandDispatcher.focusedWindow.getSelection();
			if (sel.isCollapsed) {
				windows.push(gBrowser.selectedBrowser.contentWindow.top);
			}
			else {
				windows.push(document.commandDispatcher.focusedWindow);
			}
		}
		else {
			gBrowser.browsers.forEach(
				function(e) {
					windows.push(e.contentWindow.top);
				}
			);
		}
		return windows;
	},
	findWindowsMail: function(all) {
		var windows = [];
		if (document.documentElement.getAttribute('windowtype') == 'mail:3pane') {
			windows.push(document.getElementById('messagepane').contentWindow);
		}
		else if (!all) {
			windows.push(document.commandDispatcher.focusedWindow);
		}
		else {
			windows = DTA_Mediator
				.getAllByType('mail:messageWindow')
				.map(function(w) {
					return w.content;
				});
		}
		return windows;
	},
	_types: {
		'mail:3pane': 'findWindowsMail',
		'mail:messageWindow': 'findWindowsMail'
	},
	
	findLinks: function(turbo, all) {
		try {
			if (all == undefined && turbo && DTA_preferences.getExt('rememberoneclick', false)) {
				all = DTA_preferences.getExt('lastalltabs', false);
			}
			if (turbo && all != undefined) {
				DTA_preferences.setExt('lastalltabs', all);
			}
			
			function makeUnique(i) {
				var known = {};
				return i.filter(
					function(e) {
						let url = e.url.url.spec;
						if (url in known) {
							return false;
						}
						known[url] = null;
						return true;
					}
				);
			}		
			
			if (turbo) {
				DTA_debug.logString("findLinks(): DtaOneClick request from the user");
			}
			else {
				DTA_debug.logString("findLinks(): DtaStandard request from the user");
			}

			var wt = document.documentElement.getAttribute('windowtype');
			if (wt in this._types) {
				var windows = this[this._types[wt]](all);
			}
			else {
				var windows = this.findWindowsNavigator(all);
			}
			
			var urls = [];
			var images = [];
			for each (let win in windows) {
				this.addLinks(win, urls, images, !all);
			}
			urls = makeUnique(urls);
			images = makeUnique(images);

			if (!urls.length && !images.length) {
				DTA_Prompts.alert(window, this.getString('error'), this.getString('errornolinks'));
				return;
			}
			
			if (turbo) {
				try {
					DTA_AddingFunctions.turboSaveLinkArray(urls, images);
					return;
				}
				catch (ex) {
					DTA_debug.log('findLinks', ex);
					//DTA_Prompts.alert(window, this.getString('error'), );
					DTA_AddingFunctions.saveLinkArray(urls, images, this.getString('errorinformation'));
				}
			}
			else {
				DTA_AddingFunctions.saveLinkArray(urls, images);
			}
		}
		catch(ex) {
			DTA_debug.log('findLinks', ex);
		}
	},
	
	findSingleLink: function(turbo) {
		try {
			var ctx = this.contextMenu;

			var cur = ctx.target;
			
			var tofind = ctx.onLink ? /^a$/i : /^img$/i; 
		
			while (!("tagName" in cur) || !tofind.test(cur.tagName)) {
				cur = cur.parentNode;
			}
			var url = ctx.onLink ? cur.href : cur.src;
			this.saveSingleLink(turbo, url, cur);
		}
		catch (ex) {
			DTA_Prompts.alert(window, this.getString('error'), this.getString('errornodownload'));
			DTA_debug.log('findSingleLink: ', ex);
		}
	},
	saveSingleLink: function(turbo, url, elem) {
		if (!DTA_AddingFunctions.isLinkOpenable(url)) {
			throw Error("not downloadable");
			return;
		}
		
		url = DTA_AddingFunctions.ios.newURI(url, elem.ownerDocument.characterSet, null);
		let ml = DTA_getLinkPrintMetalink(url);
		url = new DTA_URL(ml ? ml : url);
		
		let ref = DTA_AddingFunctions.getRef(elem.ownerDocument);
		let desc = this.extractDescription(elem);
		if (turbo) {
			try {
				DTA_AddingFunctions.saveSingleLink(true, url, ref, desc);
				return;
			}
			catch (ex) {
				DTA_debug.log('saveSingleLink', ex);
				DTA_Prompts.alert(window, this.getString('error'), this.getString('errorinformation'));
			}
		}
		DTA_AddingFunctions.saveSingleLink(false, url, ref, desc);		
	},
	findForm: function(turbo) {
		try {
			var ctx = this.contextMenu;
			if (!('form' in ctx.target)) {
				throw new Components.Exception("No form");
			}
			var form = ctx.target.form;
			
			var action = DTA_AddingFunctions.composeURL(form.ownerDocument, form.action);
			if (!DTA_AddingFunctions.isLinkOpenable(action.spec)) {
				throw new Components.Exception('Unsupported URL');
			}
			action = action.QueryInterface(Components.interfaces.nsIURL);
			
			var charset = form.ownerDocument.characterSet;
			if (form.acceptCharset) {
				charset = form.acceptCharset;
			}
			if (charset.match(/utf-?(?:16|32)/i)) {
				charset = 'utf-8';
			}
						
			var encoder = Components.classes['@mozilla.org/intl/texttosuburi;1']
				.getService(Components.interfaces.nsITextToSubURI);
			
			var values = []; 
			
			for (var i = 0; i < form.elements.length; ++i) {
				if (form.elements[i].name ==  '') {
					continue;
				}
				var v = encoder.ConvertAndEscape(charset, form.elements[i].name) + "=";
				if (form.elements[i].value != '') {
					v += encoder.ConvertAndEscape(charset, form.elements[i].value);
				}
				values.push(v); 
			}
			values = values.join("&");

			if (form.method.toLowerCase() == 'post') {
				var ss = Components.classes['@mozilla.org/io/string-input-stream;1']
					.createInstance(Components.interfaces.nsIStringInputStream);
				ss.setData(values, -1);
				
				var ms = Components.classes['@mozilla.org/network/mime-input-stream;1']
					.createInstance(Components.interfaces.nsIMIMEInputStream);
				ms.addContentLength = true;
				ms.addHeader('Content-Type', 'application/x-www-form-urlencoded');
				ms.setData(ss);
				
				var sis = Components.classes['@mozilla.org/scriptableinputstream;1']
					.createInstance(Components.interfaces.nsIScriptableInputStream);
				sis.init(ms);
				var postData = '';
				var avail = 0;
				while ((avail = sis.available()) != 0) {
					postData += sis.read(avail);
				}
				sis.close();
				ms.close();
				ss.close();
				
				action = new DTA_URL(DTA_AddingFunctions.ios.newURI(action.spec, form.ownerDocument.characterSet));
				action.postData = postData;
			}
			else {
				action.query = values;
				action.ref = '';
				action = new DTA_URL(DTA_AddingFunctions.ios.newURI(action.spec, form.ownerDocument.characterSet));
			}			

			
			var ref = DTA_AddingFunctions.getRef(document.commandDispatcher.focusedWindow.document);
			var desc = this.extractDescription(form);
			
			if (turbo) {
				try {
					DTA_AddingFunctions.saveSingleLink(true, action, ref, desc);
					return;
				}
				catch (ex) {
					DTA_debug.log('findSingleLink', ex);
					DTA_Prompts.alert(window, this.getString('error'), this.getString('errorinformation'));
				}
			}
			DTA_AddingFunctions.saveSingleLink(false, action, ref, desc);
		}
		catch (ex) {
			DTA_debug.log('findForm', ex);
		}
	},
	
	init: function() {
		try {
			this.direct = {};
			this.compact = {};
			
			var ctxItem = document.getElementById("dtaCtxCompact");
			var ctx = ctxItem.parentNode;
			var cont = document.getElementById('dtaCtxSubmenu');

			['SepBack', 'Pref', 'SepPref', 'TDTA', 'DTA', 'SaveT', 'Save', 'SaveFormT', 'SaveForm', 'SepFront'].forEach(
				function(id) {
					this.compact[id] = document.getElementById('dtaCtx' + id);
					var node = document.getElementById('dtaCtx' + id).cloneNode(true);
					node.setAttribute('id', node.id + "-direct");
					ctx.insertBefore(node, ctxItem.nextSibling);
					this.direct[id] = node;
				},
				this
			);
			// intitalize those to have Menu Editor pick up "good" text
			[this.direct, this.compact].forEach(
				function(m) {
					m.Save.label = this.getString('dtasavelink');
					m.SaveT.label = this.getString('turbosavelink');
				},
				this
			);

			var menu = document.getElementById("dtaToolsMenu").parentNode;
			ctx.addEventListener("popupshowing", function (evt) { DTA_ContextOverlay.onContextShowing(evt); }, false);
			menu.addEventListener("popupshowing", function (evt) { DTA_ContextOverlay.onToolsShowing(evt); }, false);

			this.ctxBase = document.getElementById('dtaCtxCompact');
			
			// prepare tools
			this.tools = {};
			['DTA', 'TDTA', 'Manager'].forEach(
				function (e) {
					this.tools[e] = document.getElementById('dtaTools' + e);
				},
				this
			);
			this.toolsBase = document.getElementById('dtaToolsMenu');
			this.toolsMenu = document.getElementById('dtaToolsPopup');
			this.toolsSep = document.getElementById('dtaToolsSep');
		}
		catch (ex) {
			Components.utils.reportError(ex);
			DTA_debug.log("DCO::init()", ex);
		}
	},
	get selectButton() {
		return document.getElementById('dta-turboselect-button') || {checked: false};
	},
	get contextMenu() {
		if (window.gContextMenu !=  null) {
			return gContextMenu;
		}
		var cm = {
			onLink: false,
			onImage: false,
			target: document.popupNode,
			fake: true
		};
		if (cm.target) {
			var node = cm.target;
			if (node instanceof Components.interfaces.nsIImageLoadingContent && node.currentURI) {
				cm.onImage = true;
			}
			while (node && !cm.onLink) {
				if (node instanceof HTMLAnchorElement && node.href) {
					cm.onLink = true;
				}				
				node = node.parentNode;
			}
		}
		return cm;
	},
	onContextShowing: function(evt) {
		try {
			var ctx = this.contextMenu;
			// get settings
			var items = DTA_preferences.getExt("ctxmenu", "1,1,0").split(",").map(function(e){return parseInt(e);});
			var compact = DTA_preferences.getExt("ctxcompact", false);
			
			var menu;
			if (compact) {
				this.ctxBase.hidden = false;
				menu = this.compact;
				}
			else {
				this.ctxBase.hidden = true;
				menu = this.direct;
			}
			
			// hide all
			for (var i in menu) {
				this.direct[i].hidden = true;
				this.compact[i].hidden = true;
			}
			// show nothing!
			if (items.indexOf(1) == -1) {
				this.ctxBase.hidden = true;
				return;
			} 
			
			// setup menu items
			// show will hold those that will be shown
			var show = [];
			
			// hovering an image or link
			if (ctx && (ctx.onLink || ctx.onImage)) {
				if (items[0]) {
					show.push(menu.Save);
				}
				if (items[1]) {
					show.push(menu.SaveT);
				}
				menu.Save.label = this.getString('dtasave' + (ctx.onLink ? 'link' : 'image'));
				menu.SaveT.label = this.getString('turbosave' + (ctx.onLink ? 'link' : 'image'));
			}
			else if (
				ctx.target
				&& ('form' in ctx.target)
			) {
				if (items[0]) {
					show.push(menu.SaveForm);
				}
				if (items[1]) {
					show.push(menu.SaveFormT);
				}		
			}			
			// regular
			else if (ctx && (ctx.fake || !(ctx.onLink || ctx.onImage))) {
				if (items[0]) {
					show.push(menu.DTA);
				}
				if (items[1]) {
					show.push(menu.TDTA);
				}
				var sel = document.commandDispatcher.focusedWindow.getSelection();
				sel = sel && !sel.isCollapsed;
				menu.DTA.label = this.getString('dta' + (sel ? 'selection' : 'regular'));
				menu.TDTA.label = this.getString('turbo' + (sel ? 'selection' : 'regular'));
			}
			
			// prefs
			if (items[2]) {
				show.push(menu.Pref);
				if (compact && (items[0] || items[1])) {
					show.push(menu.SepPref);
				}
			}
			
			// show the seperators, if required.
			var n = menu.SepFront;
			while ((n = n.previousSibling)) {
				if (n.hidden) {
					continue;
				}
				if (n.nodeName != 'menuseparator') {
					show.push(menu.SepFront);
				}
				break;
				}
			n = menu.SepBack;
			while ((n = n.nextSibling)) {
				if (n.hidden) {
					continue;
			}
				if (n.nodeName != 'menuseparator') {
					show.push(menu.SepBack);
				}
				break;
				}
			
			show.forEach(
				function (node) {
					node.hidden = false;
				}
			);
		}
		catch(ex) {
			DTA_debug.log("DTAContext(): ", ex);
		}		 
	},
	
	onToolsShowing : function(evt) {
		try {
			
			// get settings
			var menu = DTA_preferences.getExt("toolsmenu", "1,1,1").split(",").map(function(e){return parseInt(e);});
			
			// all hidden...
			var hidden = DTA_preferences.getExt("toolshidden", false);
			for (var i in this.tools) {
				this.tools[i].hidden = hidden;
			}
			this.toolsBase.hidden = hidden;
			if (hidden) {
				return;
			}

			var compact = menu.indexOf(0) != -1;
			
			// setup menu items
			// show will hold those that will be shown
			var show = [];
			
			if (menu[0]) {
				show.push('DTA');
			}
			if (menu[1]) {
				show.push('TDTA');
			}
			// prefs
			if (menu[2]) {
				show.push('Manager');
			}
			this.toolsSep.hidden = menu.indexOf(0) == -1;
			this.toolsBase.setAttribute('label', this.getString(menu.indexOf(1) != -1 ? 'moredtatools' : 'simpledtatools'));
		
			// show the items.
			for (var i in this.tools) {
				var cur = this.tools[i];
				if (show.indexOf(i) == -1) {
					this.toolsMenu.insertBefore(cur, this.toolsSep);
				}
				else {
					this.toolsBase.parentNode.insertBefore(cur, this.toolsBase);
				}
			}
		}
		catch(ex) {
			DTA_debug.log("DTATools(): ", ex);
		}
	},
	
	extractDescription: function(child) {
		var rv = "";
		try {
			var fmt = function(s) {
				try {
					return s.replace(/(\n){1,}/gi, " ").replace(/(\s){2,}/gi, " ") + " ";
				} catch (ex) { /* no-op */ }
				return "";
			};
			for (var i = 0, e = child.childNodes.length; i < e; ++i) {
				var c = child.childNodes[i];

				if (c.nodeValue && c.nodeValue != "") {
					rv += fmt(c.nodeValue);
				}

				if (c.nodeType == 1) {
					rv += this.extractDescription(c);
				}

				if (c && 'hasAttribute' in c) { 
					if (c.hasAttribute('title')) {
						rv += fmt(c.getAttribute('title'));	
					}
					else if (c.hasAttribute('alt')) {
						rv += fmt(c.getAttribute('alt'));
					}
				}
			}
		}
		catch(ex) {
			DTA_debug.log('extractDescription', ex);
		}
		return this.trim(rv);
	},
	_shiftDown: false,
	_altDown: false,
	onKeyDown: function(evt) {
		if (this._altDown && this._shiftDown) {
			return;
		}
		switch (evt.keyCode) {
			case evt.DOM_VK_ALT:
				this._altDown = true;
			break;
			case evt.DOM_VK_SHIFT:
				this._shiftDown = true;
			break;
		}
		if (this._altDown && this._shiftDown) {
			this.selectButton.checked = true;
			this.attachOneClick();
		}
	},
	onKeyUp: function(evt) {
		let upped = false;
		switch (evt.keyCode) {
			case evt.DOM_VK_ALT:
				upped = this._altDown && this._shiftDown;
				this._ctrlDown = false;
			break;
			case evt.DOM_VK_SHIFT:
				upped = this._altDown && this._shiftDown;
				this._shiftDown = false;
			break;
		}
		if (upped) {
			this.selectButton.checked = false;
			this.detachOneClick();
		}		
	},
	toggleOneClick: function(evt) {
		if (this.selectButton.checked) {
			this.attachOneClick(evt);
		}
		else {
			this.detachOneClick(evt);
		}
	},
	_attachedOneClick: false,
	_hilights: [],
	attachOneClick: function(evt) {
		if (this._attachedOneClick) {
			return;
		}
		DTA_debug.logString("attached");
		window.addEventListener('click', DTA_ContextOverlay.onClickOneClick, false);
		window.addEventListener('mousemove', DTA_ContextOverlay.onClickOneClick, false);
		this._attachedOneClick = true;
	},
	detachOneClick: function(evt) {
		if (!this._attachedOneClick) {
			return;
		}
		DTA_debug.logString("detached");
		window.removeEventListener('click', DTA_ContextOverlay.onClickOneClick, false);
		window.removeEventListener('mousemove', DTA_ContextOverlay.onClickOneClick, false);
		this._attachedOneClick = false;
		for each (let hilight in this._hilights) {
			hilight.ownerDocument.documentElement.removeChild(hilight);
		}
		this._hilights = [];
	},
	onClickOneClick: function(evt) {
		return DTA_ContextOverlay.real_onClickOneClick(evt);
	},
	real_onClickOneClick: function(evt) {
		function findElem(e, n, a) {
			function getBgImage(e) {
				if (!e || !e.ownerDocument) {
					return null;
				}
				let url = e.ownerDocument.defaultView.getComputedStyle(e, "").getPropertyCSSValue('background-image');
				if (url && url.primitiveType == CSSPrimitiveValue.CSS_URI) {
					return {elem: e, url: url.getStringValue()};
				}
				return getBgImage(e.parentNode);
			}
			if (n == 'bgimg') {
				return getBgImage(e);
			}
			if (!e) {
				return null;
			}
			if (e.localName == n && e[a]) {
				return {elem: e, url: e[a] };
			}
			return findElem(e.parentNode, n, a);
		}
		function cancelEvent(evt) {
			if (evt.cancelable) {
				evt.preventDefault();
				evt.stopPropagation();
			}
		}
		function flash(elem) {
			try {
				let flasher = createDiv('#1DEF39');
				putInFrontOf(flasher, elem);
				
				// fade our element out
				function fade() {
					let o = (parseFloat(flasher.style.opacity) - 0.03);
					if (o - 0.03 < 0) {
						doc.documentElement.removeChild(flasher);
						return;
					}
					flasher.style.opacity = o.toString();
					setTimeout(fade, 75);
				}
				setTimeout(fade, 400);
			}
			catch (ex) {
				// no op
			}
		}
		function processRegular(e) {
			let m = findElem(target, e[0], e[1]);
			if (!m) {
				return false;
			}
			cancelEvent(evt);
			try {
				DTA_ContextOverlay.saveSingleLink(true, m.url, m.elem);
				flash(m.elem);
				highlighter.style.display = 'none';
			}
			catch (ex) {
				DTA_debug.log("failed to process select " + e[0], ex);
			}
			return true;
		}
		function highlightElement(e) {
			let m = findElem(target, e[0], e[1]);
			if (!m) {
				return false;
			}
			highlighter.realTarget = m.elem;
			putInFrontOf(highlighter, m.elem);
			return true;
		}		
		function createDiv(color) {
			let div = doc.createElement('div');
			doc.documentElement.appendChild(div);
			div.style.MozBorderRadius = '5px';
			div.style.zIndex = 1000;
			div.style.opacity = '0.3';
			div.style.background = color;
			return div;
		}
		function putInFrontOf(div, elem) {
			let padding = 6;
			let ot = -1;
			let ol = -1;
			let parent = elem;
			while (parent) {
				ot += parent.offsetTop;
				ol += parent.offsetLeft;
				parent = parent.offsetParent;
			}
			div.style.width = (elem.offsetWidth + 2 * padding) + "px";
			div.style.height = (elem.offsetHeight + 2 * padding) + "px";
			div.style.top = (ot - padding) + "px";
			div.style.left = (ol - padding) + "px";
			div.style.position = (elem.style.position && elem.style.position == 'fixed') ? 'fixed' : 'absolute';
			div.style.display = 'block';
		}		
		
		let searchee = [
			['A', 'href'],
			['IMG', 'src'],
			//['bgimg', 'bgimg']
		];
		target = evt.target;
		let doc = target.ownerDocument;
		
		// hope that it doesn't exist a div with an ugly id like this in the entire www :)
		let highlighter = doc.getElementById('__dta_selector_highlighter__');
		if (!highlighter) {
			highlighter = createDiv('#FD8400');
			highlighter.id = '__dta_selector_highlighter__';
			highlighter.style.display = 'none';
			this._hilights.push(highlighter);
		}
		
		// retrieve the real event target as the highlighter is hovering it
		if (target == highlighter) {
			target = highlighter.realTarget;
		}
		
		if (evt.button != 0 || !target || target.nodeType != 1 || (target.namespaceURI && target.namespaceURI != 'http://www.w3.org/1999/xhtml')) {
			return;
		}
		
		if (evt.type == 'click') {
			searchee.some(processRegular);
		}
		else if (evt.type == 'mousemove' && !searchee.some(highlightElement)) {
			highlighter.style.display = 'none';
			return;
		}
	}
}

addEventListener("load", function() {DTA_ContextOverlay.init();}, false);
addEventListener("keydown", function(evt) {DTA_ContextOverlay.onKeyDown(evt);}, false);
addEventListener("keyup", function(evt) {DTA_ContextOverlay.onKeyUp(evt);}, false);
