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
 * The Original Code is DownThemAll! MetaLink handler
 *
 * The Initial Developers of the Original Code is Nils Maier
 * Portions created by the Initial Developers are Copyright (C) 2007
 * the Initial Developers. All Rights Reserved.
 *
 * Contributor(s):
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
 
 var Metalinker = {
 	_ios: Components.classes['@mozilla.org/network/io-service;1']
 		.getService(Components.interfaces.nsIIOService),
 		
 	_supportedHashes: ['sha1', 'md5'],
 		
 	_getSingle: function ML__getSingle(elem, name) {
 		var rv = elem.getElementsByTagName(name);
 		return rv.length ? rv[0].textContent.trim() : '';
 	},
 	_getLinkRes: function(elem, name) {
 		var rv = elem.getElementsByTagName(name);
 		if (rv.length) {
 			rv = rv[0];
 			var n = this._getSingle(rv, "name"), l = this._checkURL(this._getSingle(rv, "url"));
 			if (n && l) {
 				return [n, l];
 			}
 		}
 		return null;
 	},
 	_checkURL: function ML__checkURL(url, allowed) {
 		try {
			url = this._ios.newURI(url, null, null);
			if (url.scheme == 'file') {
				throw new Components.Exception("file protocol invalid");
			}
			// check for some popular bad links :p
			if (['http', 'https', 'ftp'].indexOf(url.scheme) != -1 && url.host.indexOf('.') == -1) {
				throw new Components.Exception("bad link!");
			}
			if (allowed instanceof Array && allowed.indexOf(url.scheme) == -1) {
				throw new Components.Exception("not allowed");
			}
			return url.spec;
 		}
 		catch (ex) {
 			// no-op
 		}
		return null; 		
 	},
 	get locale() {
 		return Preferences.get('general.useragent.locale', 'en-US');
 	},
 	handleDownload: function ML_handleDownload(download) {
 		try {
			Tree.remove(download);
			var file = new FileFactory(download.destinationFile);

			var fiStream = Cc['@mozilla.org/network/file-input-stream;1']
				.createInstance(Ci.nsIFileInputStream);
			fiStream.init(file, 1, 0, false);
			var domParser = new DOMParser();
			var doc = domParser.parseFromStream(fiStream, null, file.fileSize, "application/xml");
			var root = doc.documentElement;
			fiStream.close();
			
			try {
				file.remove(false);
			} catch (ex) {
				Debug.dump("failed to remove metalink file!", ex);
			}
			
			if (root.nodeName != 'metalink') {
				throw new Error(_('mlinvalid'));
			}
			var locale = this.locale.slice(0,2);
			var downloads = [];
			var files = root.getElementsByTagName('file');
			for (var i = 0; i < files.length; ++i) {
				var file = files[i];
				var urls = [];
				var urlNodes = file.getElementsByTagName('url');
				for (var j = 0; j < urlNodes.length; ++j) {
					var url = urlNodes[j];
					var type = url.getAttribute('type');
					var preference = 100;
					if (url.hasAttribute('preference')) {
						var a = new Number(url.getAttribute('preference'));
						if (!isNaN(a)) {
							preference = a;
						}
					}
					if (url.hasAttribute('location')) {
						var a = url.getAttribute('location').slice(0,2).toLowerCase();
						if (a == locale) {
							preference *= 10;
						}
					}
					if (['http', 'https'].indexOf(type) != -1) {
						url = this._checkURL(url.textContent.trim())
						if (url) {
							urls.push(new DTA_URL(url, doc.characterSet, null, preference));
						}
					}
				}
				if (!urls.length) {
					continue;
				}
				var hash = null; 
				var hashes = file.getElementsByTagName("hash");
				for (var j = 0; j < hashes.length; ++j) {
					var h = hashes[j];
					var t = h.getAttribute('type').toLowerCase();
					if (this._supportedHashes.indexOf('type')) {
						h = h.textContent.trim();
						// always use the longer hash ;)
						if (!hash || hash.length < h.length) {
							hash = h;
						}
					}
				}
				
				var desc = this._getSingle(file, 'description');
				if (!desc) {
					desc = this._getSingle(root, 'description');
				}
				downloads.push({
					'url': new UrlManager(urls),
					'refPage': download.refPage.spec,
					'numIstance': 0,
					'mask': download.mask,
					'dirSave': download.pathName,
					'description': desc,
					'ultDescription': '',
					'hash': hash,
					'identity': this._getSingle(file, 'identity'),
					'logo': this._checkURL(this._getSingle(file, 'logo')),
					'lang': this._getSingle(file, 'language'),
					'sys': this._getSingle(file, 'os'),
					'selected': true
				});
			}
			if (!downloads.length) {
				throw new Error(_('mlnodownloads'));
			}
			if (downloads.length > 1) {
				var info = {
					'identity': this._getSingle(root, 'identity'),
					'description': this._getSingle(root, 'description'),
					'logo': this._checkURL(this._getSingle(root, 'logo')),
					'license': this._getLinkRes(root, "license"),
					'publisher': this._getLinkRes(root, "publisher")
				};
				window.openDialog(
					'chrome://dta/content/dta/manager/metaselect.xul',
					'_blank',
					'chrome,centerscreen,dialog=yes,modal',
					downloads,
					info
				);
				downloads = downloads.filter(function(d) { return d.selected; });
			}
			if (downloads.length) {
				startnewDownloads(true, downloads);
			}
		}
		catch (ex) {
			if (!(ex instanceof Error)) {
				ex = new Error(_('mlerror', [ex.error]));
			}
			if (ex instanceof Error) {
				AlertService.show(_('mlerrortitle'), ex.message, false);
			}
			Debug.dump("Metalinker::handleDownload", ex);
		}
 	},
 	_insertDownload: function(d) {
 		if (d.lang && d.lang.search(/^\w{2}(?:-\w{2})?$/) != -1) {
 			var locale = this.locale;
 			d.selected = locale.slice(0,2) == d.lang.slice(0,2);
 		}
 		var e = document.createElement('richlistitem');
 		e.setAttribute("class", "item");
 		e.download = d;
 		$('downloads').appendChild(e); 		
 	},
 	load: function ML_load() {
 		make_();	
 		try {
 			var downloads = window.arguments[0];
 			if (downloads.length) {
 				downloads.forEach(this._insertDownload, this);
 			}
 		}
 		catch(ex) {
 			// no-op
 		}
 		var info = {
 			'identity': _('mlidentity'),
 			'description': _('mldescription'),
 			'logo': 'chrome://dta/skin/icons/metalink_big.png',
 			'publisher': null,
 			'license': null
 		}
 		try {
 			var oi = window.arguments[1];
 			for (x in info) {
 				if (x in oi && oi[x]) {
 					info[x] = oi[x];
 				}
 			}
 		}
 		catch (ex) {
 			// no-op
 		}
 		$('identity').value = info.identity;
 		$('desc').appendChild(document.createTextNode(info.description));
 		$('icon').src = info.logo;
 		if (info.publisher) {
 			var e = $('publisher');
 			e.value = info.publisher[0];
 			e.link = info.publisher[1]; 			
 		}
 		else {
 			$('boxPublisher').hidden = true;
 		}
 		if (info.license) {
 			var e = $('license');
 			e.value = info.license[0];
 			e.link = info.license[1]; 			
 		}
 		else {
 			$('boxLicense').hidden = true;
 		} 		
 	},
	accept: function ML_accept() {
		var nodes = document.getElementsByTagName('richlistitem');
		for (var i = 0; i < nodes.length; ++i) {
			nodes[i].download.selected = nodes[i].checked;
		}
	},
	cancel: function ML_cancel() {
		var nodes = document.getElementsByTagName('richlistitem');
		for (var i = 0; i < nodes.length; ++i) {
			nodes[i].download.selected = false;
		}
	},
	openLink: function(e) {
		DTA_Mediator.openTab(e.link);
	}
};