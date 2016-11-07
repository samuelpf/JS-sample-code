//
//  Sample code for demonstrating Javascript proficiency,
//  jQuery and Knockout.js frameworks are used.
//
//  Created by Samuel Pineda.
//  This code is only for demonstration purposes, just some extracts
//  from the original file are included.
//  All rights reserved.
//


{% load staticfiles %}

var editor = function(containerID, type, save_to_url){
    if (save_to_url === undefined) {
        save_to_url = true;
    }
    var self = this;
    this.blocks = ko.observableArray();
    this.currentActiveBlock = ko.observable(null);
    this.thumbnailVisible = ko.observable(true);
    this.currentActiveSlider = null;
    this.currentActiveModal = null;
    this.isActive = ko.observable(false);
    this.aspectRatio = true;
    this.applyBindingsAux = false;
    this.currentActiveEditor = null; //Para editores anidados (p.ej. varios tabs).
    this.currentSelectable = null;
    this.selectableEnabled = ko.observable(true);
    this.containerID = containerID;
    this.type = type; //Question, Answer or Section 
    this.multipleBlocksSelected = false;
    this.tableBorder = 'd9dad9';
    this.save_to_url = ko.observable(save_to_url);
    this.preview = false;
    this.savingMultiple = 0; // Para poder controlar las animaciones de fade-in y fade-out en desbloqueo de elementos.
    console.log('__ NEW EDITOR type: ' + this.type + ', containerID: ' + this.containerID + ' __');

    this.showInlineEditor = function(value){
        var type = 'none';
        if(self.currentActiveBlock()) { type = self.currentActiveBlock().type; }
        editor_model.inlineEditorVisible(value);
        editor_model.textEditorVisible(type == 'text');
        editor_model.imageEditorVisible(type == 'image' || type == 'figuras_geo');
        editor_model.htmlEditorVisible(type == 'html_editor');
        editor_model.graphVisible(type == 'graph');
        editor_model.slideshowEditorVisible(type == 'slideshow');
    };

    this.getBlockById = function(id){
        for (var i=0; i<this.blocks().length; i++){
            if(this.blocks()[i].resourceID() == id){
                console.log('Coincidencia:' +id);
                return this.blocks()[i];
            }
        }
    }

    this.pushBlock = function(blockType, style, content, id, temporal, metadata){
        var id = typeof id !== 'undefined' ? id : null;
        var temporal = typeof temporal !== 'undefined' ? temporal : null;
        var pos = self.blocks.push({
            locked                  : ko.observable(false),
            content                 : ko.observable(content),
            style                   : ko.observable(style),
           	// [...]
        });
        return self.blocks()[pos-1];
    };
    
    this.addBlock = function(blockType, style, content){
        var block = self.pushBlock(blockType, style, content, null);
        self.activateBlock(block);
        return block;
    };
    
    this.restoreBlock = function(resource, expired){
        var expired = typeof expired !== 'undefined' ? expired : false;
        var blockType = blockTypesInv[resource.type];
        var url = null;
        var file_name = '';

        var block = self.pushBlock(blockType, position, content, resource._id['$oid'], resource.temporal_version, resource.metadata);
        block.url = url;
        block.title = resource.title;
        block.wrappingGroup = resource.wrappingGroup;
        block.file_name(file_name);
        
        if(resource.type == 'ExternalResource'){
            block.isExternal = true;
            block.oembed_response = resource.oembed_response;
        }
        
        if(blockType == 'text'){
            var domBlock = $('#'+block.resourceID());
            block.style(resource.style);
            block.content(resource.html)
            $('.block').last().css('height','');
            verifyTextStructure(domBlock);
            applyBindingsToTextLines(self, domBlock[0]);
        }

        // [...]

        return block;
    };
    
    this.activateBlock = function(block){
        if(self.currentActiveBlock() != null && self.currentActiveBlock() != block){ self.saveAndClearActiveBlock(); }
        block.activeBlock(true);
        block.draggable(true);
       
        editor_model.activeBlock(block.type);
        editor_model.activateAnimations();
        if (self.save_to_url()){
            editor_model.saveMetadata(false);
        }
        self.sendBlockProperties();
    };
    
    this.sendBlockProperties = function(){
        editor_model.left(parseInt($(".active-block").css("left")));
        editor_model.top(parseInt($(".active-block").css("top")));
        editor_model.multipleSelection(false);  
        editor_model.zIndex(parseInt($(".active-block").css("z-index")));
        $('#zRange').change();
    };

    this.applyCommand = function(command, value){
        if(!$(".active-block")) return false;
        value = command == 'font-size' ? pxConversion[value]:value;
        command = commandConversion[command] ? commandConversion[command]:command;
        command = command == 'text-align' ? valueConversion[value]:command;
        
        var noSelection = window.getSelection().toString() == "";
        if(noSelection){
            if(self.currentActiveBlock().type == 'text'){
                self.activateBlock(self.currentActiveBlock());
            }
            txt_block = $('.active-block').find('.editable-div')[0];
            var selection = window.getSelection();
            var range = document.createRange();
            selection.removeAllRanges();
            range.selectNodeContents(txt_block);
            selection.addRange(range);
            document.execCommand("styleWithCSS", true, null);
            document.execCommand(command, false, value); 
            selection.removeAllRanges();
        } else {
            document.execCommand("styleWithCSS", true, null);
            document.execCommand(command, false, value); 
        }
    };

    this.mergeCells = function(){
        console.log('-- MERGE --');
        var pca = $('.selected-cell').first();
        var pcb = $('.selected-cell').last();
        var ca = {};
        var cb = {};
        
        ca.x = $(pca).index() < $(pcb).index() ? $(pca).index():$(pcb).index();
        ca.y = $(pca).parent().index() < $(pcb).parent().index() ? $(pca).parent().index():$(pcb).parent().index();
        cb.x = $(pca).index() > $(pcb).index() ? $(pca).index():$(pcb).index();
        cb.y = $(pca).parent().index() > $(pcb).parent().index() ? $(pca).parent().index():$(pcb).parent().index();
        console.log(ca.x + ', ' + ca.y + ' - ' + cb.x + ', ' + cb.y);
        
        if(ca.x != cb.x){
            var colspan = Math.abs(cb.x - ca.x) + 1;            
            var mergedCell = $('.selected-cell').first();
            $(mergedCell).attr('colspan',colspan);
            $('.selected-cell').not(mergedCell).attr('data-lx',ca.x);
            $('.selected-cell').not(mergedCell).attr('data-ly',ca.y);
            $('.selected-cell').not(mergedCell).hide();
        }
        
        if(ca.y != cb.y){
            var rowspan = Math.abs(cb.y - ca.y) + 1;            
            var mergedCell = $('.selected-cell').first();
            $(mergedCell).attr('rowspan',rowspan);
            $('.selected-cell').not(mergedCell).attr('data-lx',ca.x);
            $('.selected-cell').not(mergedCell).attr('data-ly',ca.y);
            $('.selected-cell').not(mergedCell).hide();
        }
        
        //update active-cell-helper
        var offset = $(mergedCell).position();
        $('#active-cell-helper').css({
            'left': offset.left,
            'top': offset.top,
            'width': $(mergedCell).outerWidth() + 1,
            'height': $(mergedCell).outerHeight() + 1,
        });
    };
    
    this.unmergeCells = function(){
        console.log('-- UNMERGE --');
        var table = $('.selected-cell').length > 0 ? $('.selected-cell').first().closest('table'):$('.active-cell').first().closest('table');
        if(table.length == 0) return false;
        
        $('.selected-cell, .active-cell').each(function(){
            var rowspan = $(this).attr('rowspan') ? parseInt($(this).attr('rowspan'))-1 : 0;
            var colspan = $(this).attr('colspan') ? parseInt($(this).attr('colspan'))-1 : 0;
            
            if(rowspan > 0 || colspan > 0){
                var initPos = getIndex($(this));
                var lastPos = {x: initPos.x + colspan, y: initPos.y + rowspan};
                console.log(initPos.x + ', ' + initPos.y + ' - ' + lastPos.x + ', ' + lastPos.y);
                
                for(var x=initPos.x; x<=lastPos.x; x++){
                    for(var y=initPos.y; y<=lastPos.y; y++){
                        var cell = getCell(x, y, table);
                        $(cell).attr({'data-lx':'', 'data-ly':''}).show();
                    }
                }
                $(this).attr('rowspan','');
                $(this).attr('colspan','');
            }
        });
        
        //update active-cell-helper
        self.updateCellHelper();
        clearSelectedCells();
    };

    // [...]
};

function differences(changes) {
    var properties = {};

    var diff = changes.value;
    for (var key in diff) {
        var changed = diff[key].changed;
        switch (changed) {
            case 'equal':
                break;

            case 'removed':
                aux = {};
                properties[key] = diff[key].value;
                break;

            case 'added':
                aux = {};
                properties[key] = diff[key].value;
                break;

            case 'primitive change':
                aux = {};
                properties[key] = diff[key].added;
                break;

            case 'object change':
                aux = {};
                properties[key] = differences(diff[key]);
                break;
        }
    }

    return properties;
};

function processTableForSaving(element){
    var cols = 0;
    var csv  = '';
    var trows = $(element).find('tr').not('.resizing-row');
    var rows = trows.length;
    for(var i=0; i<trows.length; i++){
        var tcols = $(trows[i]).find('th, td');
        if(i==0){ cols = tcols.length; }
        for(var j=0; j<tcols.length; j++){
            csv += $(tcols[j]).html() + ', '
        }
        csv += '\n';
    }
    return {cols: cols, rows: rows, csv: csv};
};

function selectCells(pca, pcb, table){
    var ca = {};
    var cb = {};
    
    ca.x = $(pca).index() < $(pcb).index() ? $(pca).index():$(pcb).index();
    ca.y = $(pca).parent().index() < $(pcb).parent().index() ? $(pca).parent().index():$(pcb).parent().index();
    cb.x = $(pca).index() > $(pcb).index() ? $(pca).index():$(pcb).index();
    cb.y = $(pca).parent().index() > $(pcb).parent().index() ? $(pca).parent().index():$(pcb).parent().index();
    
    var cells = new Array();
    for(var a2 = ca.y; a2 <= cb.y; a2++){
        for(var a1 = ca.x; a1 <= cb.x; a1++){
            cells.push(getCell(a1, a2, table)); 
        }
    }
    
    var cell = cells.shift();
    while(cell){
        var ccell = getIndex(cell);
        var cellVisible = $(cell).is(":visible");
        
        // Marco la celda...
        $(cell).addClass('selected-cell');
        
        // Si es una celda compuesta (merge) se actualizan los límites
        var colspan = parseInt($(cell).attr('colspan'));
        var rowspan = parseInt($(cell).attr('rowspan'));
        
        var nx = ccell.x + colspan - 1;
        if(colspan > 1 && nx > cb.x){
            for(var x = cb.x + 1; x <= nx; x++){
                for(var y = ca.y; y <= cb.y; y++){
                    cells.push(getCell(x, y, table));
                }
            }
            cb.x = nx;
        }
        if(colspan > 1 && ccell.x < ca.x){
            for(var x = ccell.x; x < ca.x; x++){
                for(var y = ca.y; y <= cb.y; y++){
                    if(!(x == ccell.x && y == ccell.y)) cells.push(getCell(x, y, table));
                }
            }
            ca.x = ccell.x;
        }
        
        var ny = ccell.y + rowspan - 1;
        if(rowspan > 1 && ny > cb.y){
            for(var x = ca.x; x <= cb.x; x++){
                for(var y = cb.y + 1; y <= ny; y++){
                    cells.push(getCell(x, y, table));
                }
            }
            cb.y = ny;
        }
        if(rowspan > 1 && ccell.y < ca.y){
            for(var x = ca.x; x <= cb.x; x++){
                for(var y = ccell.y; y < ca.y; y++){
                    if(!(x == ccell.x && y == ccell.y)) cells.push(getCell(x, y, table));
                }
            }
            ca.y = ccell.y;
        }
        
        // En el caso de celdas invisibles se agrega la celda compuesta a la fila
        if(!cellVisible){ 
            c1 = parseInt($(cell).attr('data-lx'));
            c2 = parseInt($(cell).attr('data-ly'));
            // No está dentro de los límites...
            if(c1 < ca.x || c2 < ca.y || c1 > cb.x || c2 > cb.y) cells.push(getCell(c1, c2, table));
        }
        
        cell = cells.shift();
    }
            
    // Se dibujan los bordes exteriores
    for(var a2 = ca.y; a2 <= cb.y; a2++){
        for(var a1 = ca.x; a1 <= cb.x; a1++){
            var cell = getCell(a1, a2, table);      
            var colspan = $(cell).attr('colspan') ? parseInt($(cell).attr('colspan'))-1:0;
            var rowspan = $(cell).attr('rowspan') ? parseInt($(cell).attr('rowspan'))-1:0;
            
            if(a1 == ca.x){ // Left
                var ncell = getCell(a1-1, a2, table);
                if(ncell && $(ncell).is(":visible")) $(ncell).addClass('right-border-selected'); 
                else $(cell).addClass('left-border-selected');
            }
            if(a1 + colspan == cb.x) $(cell).addClass('right-border-selected');
            if(a2 == ca.y){ // Top
                var ncell = getCell(a1, a2-1, table);
                if(ncell && $(ncell).is(":visible")) $(ncell).addClass('bottom-border-selected');
                else $(cell).addClass('top-border-selected');
            } 
            if(a2 + rowspan == cb.y) $(cell).addClass('bottom-border-selected');
        }
    }
}
    
function getCell(x, y, table){
    if(x < 0 || y < 0 || x > $(table).find('tr').first().find('td').length || y > $(table).find('tr').length )
        return null;
    var row = $(table).find('tr').get(y);
    var cell = $(row).find('td').get(x);
    return cell;
}

function getIndex(cell){
    var pos = {};
    pos.x = $(cell).parent().find('td').index(cell);
    pos.y = $(cell).parent().parent().find('tr').index($(cell).parent());
    return pos;
}

function clearSelectedCells(){
    $('.left-border-selected').removeClass('left-border-selected');
    $('.right-border-selected').removeClass('right-border-selected');
    $('.bottom-border-selected').removeClass('bottom-border-selected');
    $('.top-border-selected').removeClass('top-border-selected');
    $('.selected-cell').removeClass('selected-cell');
}

function removeTextSpans(textBlockDom, white_background){
    var text_content = '';
    var group_id_org = -1;
    var lines = textBlockDom.find('.sy-tb-line');
    var style = textBlockDom.find('.sy-tb-container').attr('style');
    for(var i=0; i<lines.length; i++){
        var has_group = false;
        var group_of_words = $(lines[i]).find('.wr-inner-group');
        var group_id = group_of_words.data('group');
        if (group_of_words.length){
            if(group_id_org == -1 || group_id_org == group_id){
                group_of_words.replaceWith(group_of_words[0].innerHTML);
            }else{
                group_of_words.replaceWith(group_of_words[0].innerHTML + ' ');
                group_id_org = group_id;
            }
            if(lines.eq(i+1).find('.wr-inner-group').length){
                if(group_id != lines.eq(index+1).find('.wr-inner-group').data('group')){
                    has_group = false;
                }else{
                    has_group = true;
                }
            }
        }
        if($(lines[i]).hasClass('sy-new-line')){
            text_content += '<br/>';
        }else if(!has_group){
            text_content += ' ';
        }
        text_content +=  $(lines[i]).html();
    }
    if (text_content != ''){
        textBlockDom.html('<div class="editable-div" contenteditable="true"><span class="sy-tb-helper" style="' + style + '">' + text_content + '</span></div>');
        if (white_background){
            $(textBlockDom).find('.editable-div').css('background-color','white');
            z_index = $(textBlockDom).css('z-index');
            $(textBlockDom).find('.editable-div').data('z', z_index);
            $(textBlockDom).css('z-index','11');
        }
    }
}

function wrapText(textBlock, linkedBlocks, textBlockDom, linkedBlocksDom){
    if(textBlock == null  || textBlockDom == null || !$(textBlockDom).hasClass('block') ){
        console.log('WrapText: No es posible completar la operación');
        return false;
    }
    
    linkedBlocks = linkedBlocks == null ? linkedBlocks : linkedBlocks.length ? linkedBlocks : null;
    linkedBlocksDom = linkedBlocksDom == null ? linkedBlocksDom : linkedBlocksDom.length ? linkedBlocksDom : null;
    if(!linkedBlocks && !linkedBlocksDom){
        removeTextSpans(textBlockDom, false);
        editor_model.currentActiveEditor().saveBlockInDB(textBlock, textBlockDom)
        console.log('WrapText: No es posible completar la operación (2)');
        return false;
    }
    
    // Obtener estilo previamente existente...
    var p_style = $(textBlockDom).find('.sy-tb-container, .sy-tb-helper').attr('style');

    // Obtener todas las palabras...
    var currentLine = null;
    var group = false;
    var blockWidth = $(textBlockDom).width();
    var newSpan = '<span class="sy-tb-line" style="width: ' + blockWidth + 'px;"></span>';
    var textBlockDom = $(textBlockDom).find('.editable-div, .sy-tb-container');
    var words = '';
    
    if($(textBlockDom).find('.sy-tb-helper').length > 0){
        $(textBlockDom).html($(textBlockDom).find('.sy-tb-helper').html());
    }
    
    if($(textBlockDom).hasClass('sy-tb-container')){
        var lines = $(textBlockDom).find('.sy-tb-line');
        var group_id_org = -1;
        var group_id;
        var linking_spans = false;
        
        for (var i = 0; i < $(lines).length; i++){
            var groups = $(lines[i]).find('.wr-inner-group');
            if($(groups).length > 0){
                for(var j=0; j<$(groups).length; j++){
                    group_id = $(groups[j]).data('group');
                    if(group_id_org == group_id){
                        linking_spans = true;
                    }
                    // Es la última parte de la palabra
                    if(linking_spans && group_id_org != group_id){ 
                        linking_spans = false;
                    } 
                    $(groups).replaceWith(groups[0].innerHTML);
                    group_id_org = group_id;        
                }
            } else if (linking_spans) {
                linking_spans = false;
            }
            
            if(i != 0 && !linking_spans) words += ' ';
            words += $(lines[i]).html();
        }
    } else {
        textBlockDom.attr('style','');
        textBlockDom.parent().css('z-index', textBlockDom.data('z'));
        words = $(textBlockDom).html();
    }
    words = words.replace(/<div><br><\/div>|<div.*?>|<br>/g,' &nl& ').replace(/<\/div>/g,'').replace(/&nbsp;|<span class="wspace">&nbsp;<\/span>/g,' ').match(/<.+?>|[^\s<>]+/g);
    
    var firstWordInSpan = true;
    var blockDom = textBlockDom[0];
    $(textBlockDom).html('');
    textBlockDom = $('<span class="sy-tb-container" data-bind="wrapText: true" contenteditable="true"></span>').appendTo(textBlockDom);
    var formatStack = new Array();
    var buffer = '';
    
    var auxSpan = $('<span></span>').appendTo('body').wrap('<span style="font-family: Arial; font-size: 13px;"></span>');
    var spaceWidth = Math.ceil(getTextWidth(' ', '13px Arial'));
    var neededWidth = 0 - spaceWidth; 
    
    // Repartir las palabras en spans, verificando si hay colisiones.
    for(var i=0; i<words.length; i++){
        var word = words[i];
        var spanGroup = "<span class='wr-inner-group' data-group='"+i+"'>";
        if(word.search(/<span .*?>|<a .*?>/g) >= 0){
            appendBuffer(buffer, formatStack, currentLine);
            buffer = '';
            formatStack.push(word);
            firstWordInSpan = true;
            continue;
        }
        if(word.search(/<\/span>|<\/a>/g) >= 0){
            appendBuffer(buffer, formatStack, currentLine);
            buffer = '';
            formatStack.pop();
            firstWordInSpan = true;
            continue;
        }
        if(word != ""){
            var wordWidth;
            if(formatStack.length == 0) {
                wordWidth = $(auxSpan).attr('style','').html(word).width() + spaceWidth;
            } else {
                var style = '';
                for(var k = 0; k < formatStack.length; k++){
                    style += formatStack[k].replace(/<.*?style="(.*?)".*?>/,'$1'); 
                }
                wordWidth = $(auxSpan).attr('style',style).html(word).width() + spaceWidth;
            }
            neededWidth += wordWidth;
            
            if(currentLine == null || neededWidth >= $(currentLine).width() || word == '&nl&'){
                if(!$(currentLine).hasClass('sy-in') || word == '&nl&'){
                    appendBuffer(buffer, formatStack, currentLine);
                    buffer = '';
                    currentLine = $(newSpan).appendTo($(textBlockDom));
                    var collisions = new Array();
                    
                    for(var j=0; j<$(linkedBlocksDom).length; j++){
                        if(testCollision(currentLine, linkedBlocksDom[j])){
                            collisions.push({
                                pi: $(linkedBlocksDom[j]).position().left,
                                pf: $(linkedBlocksDom[j]).position().left + $(linkedBlocksDom[j]).outerWidth(true)
                            });
                        }   
                    }
                    
                    if(collisions.length > 0){
                        currentLine = manageCollisions(currentLine, collisions);
                    }
                } else {
                    appendBuffer(buffer, formatStack, currentLine);
                    buffer = '';
                    currentLine = $(currentLine).nextAll('.sy-tb-line').first();
                }
                neededWidth = wordWidth - spaceWidth;
                firstWordInSpan = true;
            }
            if(word == '&nl&') {
                $(currentLine).addClass('sy-new-line');
                continue;
            }
            if(!$(currentLine).hasClass('sy-line-empty') &&  neededWidth <= $(currentLine).width()){
                if(firstWordInSpan){
                    if (group){
                        buffer += spanGroup+word+'</span>';
                        group = false;
                    }else{
                        buffer += word;
                    }                   
                    firstWordInSpan = false;    
                } else {
                    buffer += ' ' + word;
                }
            } else if(!$(currentLine).hasClass('sy-line-empty') && (wordWidth>blockWidth || group)){
                //cutword
                word_aux = '';
                while(wordWidth > $(currentLine).width()-2){
                    word_aux += word.slice(-1);
                    word = word.slice(0,-1);
                    wordWidth = $(auxSpan).html(word).width();
                }
                buffer += spanGroup+word+'</span>';
                firstWordInSpan = false;
                words[i] = reverse(word_aux);
                group = true;
                i--;
            } else {
                group = false;
                appendBuffer(buffer, formatStack, currentLine);
                buffer = '';
                firstWordInSpan = true;
                i--;
            }           
        }
    }
    appendBuffer(buffer, formatStack, currentLine);
    $(auxSpan).parent().remove();
    
    // Aplicar estilo previo
    $(textBlockDom).attr('style',p_style);
    
    // Aplicar Bindings
    applyBindingsToTextLines(self, blockDom);
};

function appendBuffer(buffer, formatStack, currentLine){
    if(buffer == '' || buffer == null) return false;
    var firstInLine = $(currentLine).html() == '';
    if(formatStack.length == 0) {
        //if(!firstInLine) $(currentLine).append('<span class="wspace">&nbsp;</span>');
        var wspace = !firstInLine ? ' ':'';
        $(currentLine).append(wspace + buffer);
    } else {
        var styleStart = '';
        var styleEnd = '';
        for(var i = 0; i < formatStack.length; i++){
            styleStart += formatStack[i]; 
            if(formatStack[i].search(/<span .*?>/) != -1) {
                styleEnd += '</span>';
            } else if(formatStack[i].search(/<a .*?>/) != -1) {
                styleEnd += '</a>';
            }
        }
        //if(!firstInLine) $(currentLine).append('<span class="wspace">&nbsp;</span>');
        var wspace = !firstInLine ? ' ':'';
        $(currentLine).append(wspace + styleStart + buffer + styleEnd);
    }
};

function reverse(s){
    return s.split("").reverse().join("");
};

function onPasteGraph(e){
    var text_copied = e.clipboardData.getData('text/html');
    text_copied = text_copied.match(/(<table(\s*|[^]+)>(\s*|[^]+)<\/table>)/igm);
    if (text_copied!=null){
        text_copied = text_copied[0];
    }else{
        return;
    }
    var table_excel = $(text_copied);
    var table = $('#table-graph');
    var table_string = '';
    var is_first = true;
    table_excel.find('tr').each(function(){
        table_string += '<tr>';
        var counter = 0;
        $(this).find('td').each(function(){
            if (!counter && is_first){
                table_string += '<td id="for_paste" class="for-paste"><input type="text"></td>';
            }else if (is_first){
                table_string += '<td class="values"><input type="text" value="'+$(this).text()+'"></td>';
            } else if (!counter){
                table_string += '<td class="category"><input type="text" value="'+$(this).text()+'"></td>';
            } else{
                table_string += '<td><input type="number" value='+$(this).text()+'></td>';
            }
            counter++;
        });
        table_string += '</tr>';
        is_first = false;
    });
    table.html(table_string);
    var trs = table_excel.find('tr');
    $('#graph_rows').val(trs.length-1);
    $('#graph_cols').val(trs.first().find('td').length-1);
    $('#for_paste')[0].onpaste = function(e){
        onPasteGraph(e);
    }
}

function getTextWidth(text, font) {
    // re-use canvas object for better performance
    var canvas = self.getTextWidth.canvas || (self.getTextWidth.canvas = document.createElement("canvas"));
    var context = canvas.getContext("2d");
    context.font = font;
    var metrics = context.measureText(text);
    return metrics.width;
};

function testCollision(txtd, objd) {
    var txt = {x: $(txtd).closest('.sy-tb-container').position().left + $(txtd).closest('.block').position().left, y: $(txtd).position().top + $(txtd).closest('.sy-tb-container').position().top + $(txtd).closest('.block').position().top, w: $(txtd).outerWidth(), h: $(txtd).outerHeight()};
    var obj = {x: $(objd).position().left, y: $(objd).position().top, w: $(objd).outerWidth(), h: $(objd).outerHeight()};
    var margin = 10;
    return !(
        ((txt.y + txt.h) < (obj.y - (margin/2))) ||
        (txt.y > (obj.y + obj.h + (margin/2))) ||
        ((txt.x + txt.w) < obj.x) ||
        (txt.x > (obj.x + obj.w))
    );
}

function manageCollisions(currentLine, collisions){
     var sp = $(currentLine).closest('.block').position().left + parseInt($(currentLine).closest('.block').css('margin-left')) + $(currentLine).closest('.sy-tb-container').position().left;
     var ep = sp + $(currentLine).outerWidth();
     var smargin = 30;
     
     if(collisions.length == 1 && collisions[0].pi - smargin < sp &&  collisions[0].pf + smargin > ep){
         $(currentLine).addClass('sy-line-empty');
         return currentLine;
     }
     
     collisions.sort(function(a, b){return a.pi - b.pi}); 
     var margin = 10;
     var imgblock = collisions.shift();
     var pi = imgblock.pi - margin;
     var pf = pi < sp ? imgblock.pf + margin : sp;
     var sycontainer = $(currentLine).parent();
     var first = null;
     $(currentLine).remove();
    
     while (pf < ep) {
         // Calcular los siguientes Pi y Pf
         while (pi <= sp || pi <= pf) {
            if(collisions.length > 0) {
                imgblock = collisions.shift();
                pi = imgblock.pi - margin;
                if(pi <= pf) pf = imgblock.pf + margin; 
            } else {
                imgblock = null;
                pi = ep;
            }
         }
         
         // Crear span con padding correspondiente
         currentLine = $('<span class="sy-tb-line sy-in" style="width: ' + (pi - pf) + 'px; padding-left: ' + (pf - sp) + 'px;"></span>').appendTo(sycontainer);
         if(first == null) first = currentLine;
         
         //Actualizar Pf
         pf = imgblock != null ? imgblock.pf + margin : ep; 
         sp = pi;
     }
     $(currentLine).removeClass('sy-in');
     $(first).addClass('sy-clear');
     
     return first;
}

function verifyTextStructure(domBlock){
    var domBlock = typeof domBlock !== 'undefined' ? domBlock : $('.active-block');
    var contents = domBlock.find('.editable-div').contents();
    if(contents.length != 1 || contents[0].tagName != 'SPAN'){
        domBlock.find('.editable-div').wrapInner('<span></span>');
    }
}

var SelOption = function(value, text){
    this.value = value;
    this.text = text;
}

var pxConversion = {
    '10px': '1',
    '13px': '2',
    '16px': '3',
    '18px': '4',
    '24px': '5',
    '32px': '6',
    '48px': '7'
};

var typesPlural = {
    'file': 'Archivos',
    'audio': 'Audio',
    'video': 'Videos',
    'image': 'Imágenes',
    'figuras_geo': 'SVG',
    'html_editor' : 'Imágenes'
};

var formats = {
    'audio': 'Arrastre un archivo .mp3',
    'video': 'Arrastre un archivo .mp4',
    'image': 'Arrastre un archivo .jpg, .png, o .gif',
    'file': 'Arrastre un archivo .doc, .pdf, .txt',
    'figuras_geo': 'Arrastre SVG',
    'html_editor' : 'Arrastre un archivo .jpg, .png, o .gif',
};

var commandConversion = {
    'font-family'      : 'fontname',
    'font-size'        : 'fontsize',
    'color'            : 'forecolor',
    'background-color' : 'backcolor',
    'font-style'       : 'italic',  
    'font-weight'      : 'bold',    
};

var valueConversion = {
    'left'   : 'justifyleft',
    'center' : 'justifycenter',
    'right'  : 'justifyright',
    'justify': 'justifyfull',
}

var blockTypes = new Array();
blockTypes['file']            = 'File';
blockTypes['icon']            = 'IconMedia';
blockTypes['modal']           = 'WindowMedia';
blockTypes['image']           = 'ImageMedia';
blockTypes['gallery']         = 'Gallery';
blockTypes['external']        = 'ExternalResource';
blockTypes['audio']           = 'Multimedia';
blockTypes['video']           = 'Multimedia';
blockTypes['table']           = 'TableMedia';
blockTypes['tabs']            = 'TabsContent';
blockTypes['text']            = 'TextMedia';
blockTypes['test']            = 'Questionary';
blockTypes['slider']          = 'Gallery';
blockTypes['math']            = 'Math';
blockTypes['button']          = 'ButtonMedia';
blockTypes['figuras_geo']     = 'FigureMedia';
blockTypes['quizb']           = 'ButtonMedia';
blockTypes['html_editor']     = 'HTMLMedia';
blockTypes['graph']           = 'graph';
blockTypes['slideshow']       = 'slideshow';
blockTypes['thumbnail_slide'] = 'thumbnail_slide';

var blockTypesInv = new Array();
blockTypesInv['File']             = 'file';
blockTypesInv['IconMedia']        = 'icon';
blockTypesInv['WindowMedia']      = 'modal';
blockTypesInv['ImageMedia']       = 'image';
blockTypesInv['Gallery']          = 'gallery';
blockTypesInv['ExternalResource'] = 'external';
blockTypesInv['Multimedia']       = 'multimedia';
blockTypesInv['TableMedia']       = 'table';
blockTypesInv['TabsContent']      = 'tabs';
blockTypesInv['TextMedia']        = 'text';
blockTypesInv['FigureMedia']      = 'figuras_geo';
blockTypesInv['Questionary']      = 'questionary';
blockTypesInv['Math']             = 'math';
blockTypesInv['ButtonMedia']      = 'button';
blockTypesInv['HTMLMedia']        = 'html_editor';
blockTypesInv['graph']            = 'graph';
blockTypesInv['slideshow']        = 'slideshow';
blockTypesInv['thumbnail_slide']  = 'thumbnail_slide';