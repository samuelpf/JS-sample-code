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
            locked_por              : ko.observable(''),
            locked_id               : ko.observable(''),
            group                   : ko.observable(false), // para mostrar los elementos que pertenecen al grupo
            type                    : blockType,
            title                   : null,
            content                 : ko.observable(content),
            style                   : ko.observable(style),
            url                     : null,
            goto_url                : ko.observable('#'),
            activeBlock             : ko.observable(false),
            editable                : ko.observable(false),
            draggable               : ko.observable(false),
            resizable               : ko.observable(false),
            activeSlider            : ko.observable(false),
            wasDragged              : ko.observable(false),
            wasResized              : ko.observable(false),
            preventSecondClick      : false,
            loadingFirstTime        : true,
            resourceID              : ko.observable(id),
            temporalVersion         : temporal,
            containedResources      : new Array(), //arreglo de los ids de los recursos contenidos.
            swiperThumbnailsVisible : ko.observable(true),
            mathVisible             : ko.observable(false),
            mathFirst               : ko.observable(true),
            mas16                   : ko.observable(false),
            buttonText              : ko.observable('Botón'), //For modal
            cModalTitle             : ko.observable(''),
            cModalContent           : ko.observable(''),
            buttonAnchor            : null,
            isExternal              : false,
            isClone                 : false,
            oembed_response         : null,
            mediaThumbnailVisible   : ko.observable(true),
            captionVisible          : ko.observable(false),
            captionPosition         : ko.observable(true),
            captionCustomSize       : ko.observable(0),
            metadata                : ko.observable(metadata),
            guardando               : ko.observable(false),
            file_name               : ko.observable(''),
            htmlVisible             : ko.observable(true),
            wrappingGroup           : new Array(), // El texto contiene las referencias a todos los recursos que afectan su disposición, los demás
                                                   // recursos (como imágenes) tienen la referencia a todos los textos que afectan.
            savingActive            : ko.observable(false), // Para poder controlar las animaciones de fade-in y fade-out en desbloqueo de elementos.
            graphJSON               : ko.observable(null), // JSON con los datos para pintar una gráfica
            graphType               : ko.observable(null), // Tipo de la gráfica
            graphConfig             : ko.observable(null), // Configuración de la gráfica
            slides                  : ko.observable(null), // Arreglo para los ids de las diapositivas
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

        if(blockType == undefined){
            return;
        }
        if(blockType == 'multimedia'){
            blockType = resource.media_type;
            url = resource.url;
        }
        if(blockType == 'external'){
            blockType = resource.external_type == 'link' ? 'image':resource.external_type;
            url = resource.url;
        }
        if(blockType == 'button'){
            blockType = resource.button_type == 'Questionary' ? 'quizb':'button';
        }
        if(blockType == 'file'){
            url = resource.url;
            file_name = resource.file_name;
        }
        if (blockType == 'thumbnail_slide'){
            editor_model.thumbnail_slide(resource.thumbnail_slide);
            return;
        }
        
        var content = sampleContent[blockType];
        var position = resource.style.match(/left:\s\-?(\d+)(\.\d+)?px;\stop:\s\-?(\d+)(\.\d+)?px;/);
        if (position) {
            position = position[0];
        }
        var z_index = resource.style.match(/z\-index:\s\-?(\d+);/);
        if (z_index) {
            position += z_index[0];
        }

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

        if (blockType == 'slideshow'){
            block.slides(resource.slides);
            block.goto_url(resource.goto_url)
            var domBlock = $('#'+block.resourceID());
            ko.applyBindings(self, domBlock.find('.bhelper1')[0])
            ko.applyBindings(self, domBlock.find('.go-slideshow')[0]);
            domBlock.find('.go-slideshow').click(function(e){
                e.preventDefault();
                $.ajax({
                    url: block.goto_url(),
                    type: 'POST',
                    success: function(data){
                        if(self.preview){
                            $('.overlay').first().css('z-index', 1002);
                        }
                        $('#slideshow_modal').find('.dialog-section').html(data);
                        $('#slideshow_modal').dialog('option','title',block.title);
                        
                        if(editor_model.navigation_vertical()){
                            $('#slideshow_modal .bottom-section').addClass('vertical');
                            $('#slideshow_modal .thumbnail-container').after($('#slideshow_modal .show-thumbnails'));
                        }
                        
                        if(editor_model.navigation_type() == 'timeline' && editor_model.is_slide_preview()){
                            $('.bottom-section').addClass('timeline');
                            var count = $('.bottom-section .slide-thumbnail').length;
                            if(editor_model.navigation_vertical()){
                            $('.bottom-section .slide-thumbnail').css('height', 100/count + '%');
                            } else {
                                $('.bottom-section .slide-thumbnail').css('width', 100/count + '%');
                            }
                        }
                    
                        if(editor_model.navigation_type() == 'list' && editor_model.is_slide_preview()){
                            $('.top-section').addClass('right');
                            $('.bottom-section').addClass('list').addClass('right');
                            var count = $('.bottom-section .slide-thumbnail').length;
                            if(!editor_model.navigation_vertical()){
                                $('.bottom-section .slide-thumbnail').css('width', 100/count + '%');
                            }
                        }
                        
                        $('#slideshow_modal').dialog('open');
                        
                        // Este no puede ir antes de abrir el diálogo porque Slick no calcula el width apropiadamente.
                        if(editor_model.navigation_type() == 'thumbnail'){
                            $('.bottom-section').addClass('thumbnail');
                            $('.bottom-section .slide-thumbnail').wrap('<div>');
                            $('.bottom-section .thumbnail-container').slick({
                                infinite: false, 
                                slidesToShow: 4, 
                                slidesToScroll: 4,
                                vertical: editor_model.navigation_vertical(),
                            });
                        }
                
                        var elem = $('.slide-preview-container')[0]
                        $(document).keydown(function(event){
                            console.log(event.which);
                            var current_order = editor_model.current_slide_order();
                            switch (event.which){
                                case 39:
                                    if (current_order < slides_order.length-1){
                                        $('.active-slide').removeClass('active-slide');
                                        $($('.slide-thumbnail')[current_order+1]).addClass('active-slide');
                                        editor_model.showSlidePreview(current_order+1, true);
                                        editor_model.current_slide_order(current_order+1);
                                    }
                                    if (editor_model.timeouts().length){
                                        editor_model.clearTimeOuts();
                                    }
                                    break;
                                case 37:
                                    if (current_order > 0){
                                        $('.active-slide').removeClass('active-slide');
                                        $($('.slide-thumbnail')[current_order-1]).addClass('active-slide');
                                        editor_model.showSlidePreview(current_order-1, true);
                                        editor_model.current_slide_order(current_order-1);
                                    }
                                    if (editor_model.timeouts().length){
                                        editor_model.clearTimeOuts();
                                    }
                                    break;
                            }
                        });
                        $('.fullscreen_btn').click(function(){
                            zoom_factor = screen.height/675
                            $('.slide-preview-container').css('transform','scale('+zoom_factor+')');
                            if ( screenfull ) {
                                screenfull.request( elem );
                            }
                        });
                    }
                });
            });
        }
        
        if(block.type == 'image' || block.type == 'figuras_geo'){
            var domBlock = $('#'+block.resourceID());
            var rotation = typeof resource.rotation !== 'undefined' ? resource.rotation:0;
            if(rotation > 0){
               domBlock.css('-webkit-transform','rotate('+rotation+'deg)');
               domBlock.css('-o-transform','rotate('+rotation+'deg)');
               domBlock.css('-moz-transform','rotate('+rotation+'deg)');
               domBlock.css('transform','rotate('+rotation+'deg)');
               domBlock.attr('data-rotate',rotation);
            }
        }
        
        if(block.type == 'image' || block.type == 'audio' || block.type == 'video' || block.type == 'table' || block.type == 'math'){
            var domBlock = $('#'+block.resourceID());
            var visible = typeof resource.caption !== 'undefined' ? resource.caption:'';
            var content = typeof resource.caption_content !== 'undefined' ? resource.caption_content:'';
            var position = typeof resource.caption_pos !== 'undefined' ? resource.caption_pos:true;
            var size = typeof resource.caption_custom_size !== 'undefined' ? resource.caption_custom_size:0;
            var style = typeof resource.caption_style !== 'undefined' ? resource.caption_style:'';
            self.defineCaption(visible, content, position, size, style, block, domBlock);
        }
        
        if(blockType == 'image'){
            var domBlock = $('#' + block.resourceID());
            var url = typeof resource.url !== 'undefined' ? resource.url:'';
            var title = typeof resource.title !== 'undefined' ? resource.title:'';
            var flip_h = typeof resource.flip_h !== 'undefined' ? resource.flip_h:false;
            var flip_v = typeof resource.flip_v !== 'undefined' ? resource.flip_v:false;
            var inner_style = typeof resource.inner_style !== 'undefined' ? resource.inner_style:resource.style.match(/(width|height|border):\s*\d+\.?\d+px;/g).join(' ');
            self.defineImage(url, title, block, domBlock, inner_style, flip_h, flip_v);
        }
        
        if(blockType == 'video' || blockType == 'audio'){
            var domBlock = $('#'+block.resourceID());
            if(block.isExternal){
                self.embedMedia(block.oembed_response, block, domBlock);
            } else {
                var url = typeof resource.url !== 'undefined' ? resource.url:'';
                var name = typeof resource.title !== 'undefined' ? resource.title:'';
                self.defineMedia(blockType, url, name, block, domBlock);    
            }
        }
        
        if(blockType == 'modal'){
            var domBlock = $('#'+block.resourceID());
            var button_text = typeof resource.button_text !== 'undefined' ? resource.button_text : '';
            var title = typeof resource.title !== 'undefined' ? resource.title : '';
            var html = typeof resource.html !== 'undefined' ? resource.html : '';
            self.defineModal(button_text, title, html, block, domBlock);
        }
        
        if(blockType == 'button' || blockType == 'ButtonMedia'){
            var domBlock = $('#'+block.resourceID());
            self.defineButton(resource.text, block, domBlock);
            self.defineButtonAnchor(resource.goes_to, block, domBlock);
        }
        
        if(blockType == 'table'){
            var domBlock = $('#'+block.resourceID());
            self.defineTable(block, domBlock, resource.table_content);
        }
        
        if(blockType == 'slider' || blockType == 'gallery'){
            var domBlock = $('#'+block.resourceID());
            var images = JSON.parse(resource.images);
            block.type = resource.slider ? 'slider':'gallery';
            self.defineImagesSlider(images, block, domBlock);
        }
        
        if(blockType == 'math'){
            var domBlock = $('#'+block.resourceID());
            var text_code = typeof resource.text_code !== 'undefined' ? resource.text_code : '';
            self.defineMath(text_code, block, domBlock);
        }
        
        if(blockType == 'quizb'){
            var domBlock = $('#'+block.resourceID());
            var text = typeof resource.text !== 'undefined' ? resource.text : '';
            var url = typeof resource.goto_url !== 'undefined' ? resource.goto_url : '';
            var mas16 = typeof resource.mas16 !== 'undefined' ? resource.mas16 : false;
            self.defineQuiz(text, url, mas16, block, domBlock);
        }
        
        if(blockType == 'file'){
            var domBlock = $('#'+block.resourceID());
            var doc_type = "{% static 'theme/dark/icons/txt_file.png' %}";
            if (resource.url.endsWith('.doc') || resource.url.endsWith('.docx')){
                doc_type = "{% static 'theme/dark/icons/doc.png' %}";
            } else if (resource.url.endsWith('.pdf')){
                doc_type = "{% static 'theme/dark/icons/pdf.png' %}";
            }
            domBlock.find('img').attr('src',doc_type);
            domBlock.find('.file_url').html(block.url);
            ko.applyBindings(block, domBlock.find('.doc_name')[0]);
        }
        
        if(blockType == 'figuras_geo'){
            var domBlock = $('#'+block.resourceID());
            block.style(resource.style);
            block.content(resource.html)
        }

        return block;
    };
    
    // Cancela el abrir la ventana modal...
    this.activateBlock = function(block){
        if (block.resourceID() == 'temporal'){
            block.resourceID(null);
        }
        if (block.resourceID() != null && block.locked() && block.locked_id() != editor_model.user ){
            alert('El elemento esta bloqueado por '+ block.locked_por());
            return;
        }
        if(block.guardando()){
            return;
        }

        if (block.resourceID() != null && !block.locked() && self.save_to_url()) {
            block.locked(true);
            block.locked_id(editor_model.user);
            $.ajax({
                url: editor_model.resources_url(),
                type: "POST",
                data: {'resource_id':block.resourceID(), 'action':'lock'},
                success: function (data) {
                    console.log('-- block LOCKED --');
                },
                error: function(data) {
                    block.locked(false);
                    block.locked_por('');
                },
            });
        }
        console.log('ACTIVATE BLOCK', block.activeBlock());
        if(self.multipleBlocksSelected){ return false; }


        if(block.wrappingGroup && block.wrappingGroup.length){
            if(block.type == 'text'){
                for (var i=0; i<block.wrappingGroup.length; i++){
                    self.lockBlock(block.wrappingGroup[i]);
                }
            }else{
                self_id = block.wrappingGroup[0];
                self.lockBlock(self_id);
                block_aux = self.getBlockById(self_id);
                for (var i=0; i<block_aux.wrappingGroup.length; i++){
                    if(block_aux.wrappingGroup[i] != block.resourceID()){
                        self.lockBlock(block_aux.wrappingGroup[i]);
                    }
                }
            }
        }
        
        if (block.activeBlock() && block.type == 'text'){
            removeTextSpans($('.active-block'), true);
        }

        console.log("ACT1 - a: "+block.activeBlock()+", d: "+block.draggable()+", e:"+block.editable());
        if(block.preventSecondClick) { block.preventSecondClick = false; return false; }
        if(block.activeBlock() && block.editable()) { return false; }
        if(block.activeBlock() && (block.type == 'text' || block.type == 'tabs' || block.type == 'table' || block.type == 'slider' || block.type == 'math' || 
           block.type == 'image' || block.type == 'audio' || block.type == 'video' || block.type == 'html_editor')){ 
            block.editable(true);
            block.draggable(false);
            block.htmlVisible(true);
            self.disableSelectable();
            console.log("ACT2** - a: "+block.activeBlock()+", d: "+block.draggable()+", e:"+block.editable());
            return false; 
        }
        
        if(!block.activeBlock() && (block.type == 'gallery' || block.type == 'slider')){ block.activeSlider(false); }
        console.log('CURRENT ACTIVE BLOCK', self.currentActiveBlock(), 'BLOCK', block.resourceID());
        if(self.currentActiveBlock() != null && self.currentActiveBlock() != block){ self.saveAndClearActiveBlock(); }
        block.activeBlock(true);
        block.draggable(true);
        if(block.type == 'text' || block.type == 'figuras_geo' || block.type == 'html_editor'){ block.resizable(true); }
        console.log('SELF BLOCK', block.resourceID());
        self.currentActiveBlock(block);
        console.log('SELF CURRENT ACTIVE_BLOCK', self.currentActiveBlock().resourceID());
        if(block.loadingFirstTime){ block.loadingFirstTime = false; }
        console.log("ACT2 - a: "+block.activeBlock()+", d: "+block.draggable()+", e:"+block.editable());
        //moduleContext.notify('ACTIVE_BLOCK', block.type);
        editor_model.activeBlock(block.type);
        editor_model.activateAnimations();
        if (self.save_to_url()){
            editor_model.saveMetadata(false);
        }
        self.sendBlockProperties();
        if(block.type == 'image'){ self.sendImageBlockProperties(); self.sendCaptionProperties(); }
        if(block.type == 'text'){ self.sendTextBlockProperties(); }
        if(block.type == 'table'){ self.sendTableBlockProperties(); self.sendCaptionProperties(); }
        if(block.type == 'button' || block.type == 'ButtonMedia'){ self.sendButtonBlockProperties(); }
        if(block.type == 'tabs'){ self.sendTabsBlockProperties(); }
        if(block.type == 'video'){ self.sendMediaBlockProperties(); self.sendCaptionProperties(); }
        if(block.type == 'audio'){ self.sendMediaBlockProperties(); self.sendCaptionProperties(); }
        if(block.type == 'gallery' || block.type == 'slider'){ self.sendSwiperBlockProperties(); }
        if(block.type == 'modal'){ self.sendModalBlockProperties(); }
        if(block.type == 'quizb'){ self.sendQuizbBlockProperties(); }
        if(block.type == 'math'){ self.sendCaptionProperties(); self.sendLatex(); self.sendCaption();}
        if(block.type == 'file'){ self.sendFileProperties();}
        if(block.type == 'figuras_geo'){ self.sendSVGBlockProperties(); }
        if(block.type == 'graph'){ self.sendGraphProperties(); }

        block.wasDragged(true);
        self.showInlineEditor(true);
        block.mediaThumbnailVisible(true);
        self.thumbnailVisible(true);
        self.disableSelectable();
        console.log('Pase llamada de disable Selectable');

        if (block.wrappingGroup != undefined && block.wrappingGroup.length){
            editor_model.is_group(true);
        }

        if (block.type == 'html_editor'){
            applyTinyMCE();
        }

        if (self.save_to_url()){
            console.log('BLOCK METADATA', block.metadata());
            if (block.metadata() != undefined){
                editor_model.restoreJson(block.metadata());
            }else{
                editor_model.initMeta();
            }
        }
        editor_model.title(block.title)
        //Ir por Json de metadatos
    };

    this.lockBlock = function(resource_id){
        block = self.getBlockById(resource_id);
        if(block.locked()){return};
        block.locked(true);
        block.group(true);
        block.locked_id(editor_model.user);
        $.ajax({
            url: editor_model.resources_url(),
            type: "POST",
            async: false,
            data: {'resource_id':resource_id, 'action':'lock'},
            success: function (data) {
                console.log('-- block LOCKED --');
            },
            error: function(data) {
                block.locked(false);
                block.locked_por('');
                block.group(false);
            },
        });
    };

    this.unlockBlock = function(resource_id){
        block = self.getBlockById(resource_id);
        $.ajax({
            url: editor_model.resources_url(),
            type: "POST",
            async: false,
            data: {'resource_id':resource_id, 'action':'unlock'},
            success: function (data) {
                console.log('-- block UnLOCKED --');
                block.locked(false);
                block.group(false);
            }
        });
    };
    
    this.saveAndClearActiveBlock = function(){
        current_active = self.currentActiveBlock();
        if (!current_active && self.save_to_url()){
            editor_model.saveMetadata();
            return;
        }
        if (current_active && current_active != 'multiple' && current_active.wrappingGroup && current_active.wrappingGroup.length){
            if(current_active.type != 'text'){
                block_to_save = self.getBlockById(current_active.wrappingGroup[0]);
                if(block_to_save){
                    self.saveBlockInDB(block_to_save, $('#'+current_active.wrappingGroup[0]), true);
                }
            }else{
                related_blocks = current_active.wrappingGroup;
                var linkedBlocks = new Array();
                var linkedBlocksDom = new Array();
                for (var i=0; i<related_blocks.length; i++){
                    single_block = $('#'+related_blocks[i]); 
                    linkedBlocks.push(ko.dataFor(single_block[0]));
                    linkedBlocksDom.push(single_block);
                }
                wrapText(current_active, linkedBlocks, $('.active-block'), linkedBlocksDom);
            }
        }
        if (current_active && current_active != 'multiple'){
            self.currentActiveBlock().savingActive(true);
            self.saveBlockInDB(self.currentActiveBlock(), undefined, true);
        }
        self.clearActiveBlock(false);
        editor_model.collapseAccordion();
    };
    
    this.getBlockData = function(block, domBlock){
        if(block == null || block.guardando()){ return null; }
        var domBlock = typeof domBlock !== 'undefined' ? domBlock : $('.active-block');
        console.log('BLOQUE DE GETBLOCKDATA', block.style());
        // Elementos que deben eliminarse antes de guardar el recurso en BD.
        $('.resizing-row').remove();
        
        var style = block.style();
        try {
            if (style.match(/width/) == null) style += ' width: ' + $(domBlock).css('width') + ';';
            if (style.match(/height/) == null) style += ' height: ' + $(domBlock).css('height') + ';';
        } catch (e) {
            return null;
        }

        var metadata;
        console.log('METADATAMETADATA', block.metadata())
        metadata = editor_model.makeJson();

        console.log('GET BLOCK DATA METADATA', metadata);
        var block_data = {
            title         : block.title,
            desc          : null,
            private       : true,
            author_version: null,
            style         : style,
            type          : blockTypes[block.type],
            wrappingGroup : block.wrappingGroup,
        };
        if(!self.multipleBlocksSelected){
            block_data.metadata = metadata
        }
        if(block.isExternal){
            block_data['type']            = 'ExternalResource'; 
            block_data['external_type']   = block.type;
            block_data['config']          = '';
            block_data['url']             = block.url;
            block_data['oembed_response'] = block.oembed_response;
        }
        
        if(self.type == 'section'){
            block_data['section_id'] = self.containerID;
        }

        if(block.type == 'file'){
            block_data['url'] = block.url;
            block_data['file_name'] = block.file_name();
        }

        if (block.type == 'slideshow'){
            block_data['slides'] = block.slides();
        }

        if(block.type == 'text'){
            block_data['html'] = getContent($(domBlock));
        }

        if (block.type == 'html_editor'){
            if($('.active-block').find('.iframe').css('display') == 'none' && $('.active-block').find('.regresar').css('display') != 'none'){
                var code_content = editor_viewer.getValue();
                tinymce.editors[0].setContent(code_content);
            }
            head = $(domBlock).find('iframe')[0].contentDocument.head;
            var styleSheets = $(domBlock).find('iframe')[0].contentDocument.styleSheets;
            $(head).html('');
            var style_len = styleSheets.length;
            var hrefs = [];
            for (var i=0; i<style_len;i++){
                if(styleSheets[i].href){
                    hrefs.push(styleSheets[i].href);
                }
            }
            for (var i=0; i<hrefs.length; i++){
                $(head).append("<link href='"+hrefs[i]+"' type='text/css' rel='stylesheet' />")
            }
            ifr_body = $(domBlock).find('iframe').first().contents().find('body');
            $(ifr_body).attr('contenteditable', 'false'); 
            content = $(domBlock).find('iframe').first().contents().find('html')[0].outerHTML;
            try{
                tinyMCE.execCommand('mceRemoveEditor',false, tinymce.editors[0].id);
            }catch(e){
                console.log('Error al borrar el tinymce');
            }
            $(domBlock).find('.mce-tinymce').remove()
            block_data['html_content'] = getContent($(domBlock));
            block_data['html'] = content;
        }

        if (block.type == 'graph'){
            block_data['graphType'] = block.graphType();
            block_data['graphJSON'] = block.graphJSON();
            block_data['graphConfig'] = block.graphConfig();
            block_data['html'] = $(domBlock).find('svg')[0].outerHTML;
        }
        
        if(block.type == 'image' || block.type == 'figuras_geo'){
            block_data['rotation'] = typeof $(domBlock).data('rotate') !== 'undefined' ? $(domBlock).data('rotate'):0;
        }
        
        if(block.type == 'image' || block.type == 'audio' || block.type == 'video' || block.type == 'table' || block.type == 'math' || block.type == 'graph'){
            block_data['caption']             = block.captionVisible();
            block_data['caption_pos']         = block.captionPosition();
            block_data['caption_content']     = $(domBlock).find('.image-caption .editable-div').html();
            //TODO: esta llave parece que ya no es necesaria, el width se incluye en caption_style
            block_data['caption_custom_size'] = block.captionCustomSize();
            block_data['caption_style']       = $(domBlock).find('.image-caption').attr('style');
            
            var inner_element;
            if(block.type == 'image') inner_element = '.image';
            if(block.type == 'audio' || block.type == 'video') inner_element = '.thumbnail';
            if(block.type == 'table') inner_element = 'table';
            if(block.type == 'math') inner_element = '.latex';
            block_data['inner_style'] = 'width: ' + $(domBlock).find('.image').css('width') + ';' +
                                        'height: ' + $(domBlock).find('.image').css('height') + ';' + 
                                        'border: ' + $(domBlock).find('.image').css('border') + ';';
        }
        
        if(!block.isExternal && block.type == 'image'){
            block_data['url']         = $(domBlock).find('img').attr('src') != undefined ? $(domBlock).find('img').attr('src'):null;
            block_data['alt']         = $(domBlock).find('img').attr('alt') != undefined ? $(domBlock).find('img').attr('alt'):'default';
            block_data['style']       += ' border: ' + $(domBlock).find('img').css('border') + ';';     
            block_data['flip_h']       = $(domBlock).find('.image').hasClass('flip-h') || $(domBlock).find('.image').hasClass('flip-both');
            block_data['flip_v']       = $(domBlock).find('.image').hasClass('flip-v') || $(domBlock).find('.image').hasClass('flip-both'); 
            if(!block_data['url']){ return false; }
        }
        
        if(!block.isExternal && (block.type == 'audio' || block.type == 'video')){
            block_data['media_type'] = block.type;
            block_data['url']        = block.url;
            block_data['start_at']   = 0;
            block_data['autoplay']   = 0;
            if(!block_data['url']){ return false; }
        }
        
        if(block.type == 'table'){
            var table_info = processTableForSaving($(domBlock));
            block_data['header'] = '';
            block_data['rows']   = table_info.rows;
            block_data['cols']   = table_info.cols;
            block_data['csv']    = table_info.csv;  
            block_data['table_content'] = $(domBlock).find('.ctable').html();
        }
        
        if(block.type == 'button' || block.type == 'ButtonMedia'){
            block_data['text'] = block.buttonText();
            block_data['goes_to'] = block.buttonAnchor;
            block_data['button_type'] = 'Section';
        }
        
        if(block.type == 'modal'){
            block_data['title'] = block.cModalTitle();
            block_data['html']  = block.cModalContent();
            block_data['button_text'] = block.buttonText();
        }
        
        if(block.type == 'tabs'){
            return false;
        }
        
        if(block.type == 'slider'){
            var slides = $(domBlock).find('.cslide-caption');
            for(var i=0; i<slides.length; i++){
                block.containedResources[i].text = $(slides[i]).html();
            }
        }
        
        if(block.type == 'gallery' || block.type == 'slider'){
            block_data['autoplay']          = false;
            block_data['seconds_per_slide'] = 0;
            block_data['loop']              = false;
            block_data['transition']        = 0;
            block_data['interactive']       = false;
            block_data['images']            = JSON.stringify(block.containedResources);
            block_data['slider']            = block.type == 'slider' ? true:false;
            block_data['thumbnails']        = block.swiperThumbnailsVisible();
        }

        if (block.type == 'figuras_geo'){
            block_data['html'] = getContent($(domBlock));
        }

        if (block.type == 'math'){
            math_data = $(domBlock).find('.mathquill-editor').mathquill('latex');
            if (math_data === undefined){
                math_data = $(domBlock).find('.latex-hidden').html();
            }
            block_data['text_code'] = math_data;
        }
        
        if(block.type == 'quizb'){
            block_data['text'] = block.buttonText();
            block_data['button_type'] = 'Questionary';
            block_data['goes_to'] = null;
            block_data['goto_url'] = block.goto_url();
            block_data['mas16'] = block.mas16()
        }
        
        if (block.type == 'html_editor' && block.temporalVersion == ''){
            block.temporalVersion = JSON.stringify(block_data)
        }
        block_data['temporal_version'] = JSON.stringify(block_data);
        block_data['temporal_version'] = block_data['temporal_version'].replace(/[^\\]\\"/g, "'");
        
        return block_data;
    };
    
    this.saveBlockInDB = function(block, domBlock, unlock){
        if(block == null || block == 'multiple'){ return false; }
        var domBlock = typeof domBlock !== 'undefined' ? domBlock : $('.active-block');
        block.style($(domBlock).attr('style'));
        
        //El contenido de audio y video se actualiza sólo en embed media.
        if(block.type == 'text'){
            block.content(getContent($(domBlock)));
        }
        if (block.type == 'figuras_geo'){
            try{
                serializer = new XMLSerializer();
                content = serializer.serializeToString($(domBlock).children()[0].contentDocument.querySelector('svg'));
            }catch (err){
                content = getContent($(domBlock));
            }
            block.content(content);
        }

        var block_data = self.getBlockData(block, domBlock);

        if (block.type == undefined){
            return;
        }

        if (block_data == null || (block.type == 'table' && block_data['table_content'] == '')){
            return;
        }

        if (block.type == 'math' && block.mathVisible()){
            return;
        }

        if (!block_data){
            return false;
        }
        if(block.isClone){ 
            block_data['clone'] = block.isClone; 
            block.isClone = false; 
        }   
            
        console.log('** BLOCK DATA **');
        console.log(block_data);
        
        // TEMPORAL
        if( block.type == 'tabs'){
            return false;
        }
        if(editor_model.edu_content_id){
            block_data['edu_content_id'] = editor_model.edu_content_id;
        }else{
            block_data['instance_id'] = editor_model.instance_id;
        }
        if (block.type == 'image' || block.type == 'audio' || block.type == 'video' || block.type == 'external'){
            block_data['media_resources'] = editor_model.media_resources();
        }
        if (!self.save_to_url()) {
            return;
        }

        if(block.resourceID() == 'temporal'){
            block.resourceID(null);
        }

        if(!block.resourceID()){ // Nuevo
            console.log('ENTRE GUARDAR NUEVO');
            block.guardando(true);
            $.ajax({
                url: editor_model.resources_url(),
                type: "POST",
                headers: {'X-HTTP-Method-Override': 'PUT'},
                data: {'_content':JSON.stringify(block_data)},
                success: function (data) {
                    console.log('-- save block in DB --');
                    block.resourceID(data.res_pk);
                    if (block.type == 'quizb'){
                        block.goto_url(data.questionary_url);
                        $(domBlock).find('.bhelper2').attr('href',block.goto_url());
                    }
                    block.temporalVersion = JSON.stringify(block_data);
                    if(self.type == 'Section'){
                        block.locked(true);
                        block.locked_id(editor_model.user);
                        //self.edit_secres(block);
                    }
                    $.ajax({
                        url: editor_model.resources_url(),
                        type: "POST",
                        data: {'resource_id':block.resourceID(), 'action':'unlock'},
                        success: function (data) {
                            if (unlock){
                                
                                block.locked_por('');
                            }
                            console.log('-- block UNLOCKED --');
                        }
                    });
                    block.guardando(false);
                }
            });
        } else { // Update
            var diff = objectDiff.diff(JSON.parse(block.temporalVersion), block_data);
            console.log('-- DIFERENCIAS --', diff);
            if(diff.changed == 'equal'){ return false; }
            diff = differences(diff);
            if(!self.multipleBlocksSelected) {
                diff['metadata'] = block_data['metadata'];
            }
            else {
                delete diff['metadata'];
            }
            
            if(block.wrappingGroup && block.wrappingGroup.length > 0){
                diff['wrappingGroup'] = block.wrappingGroup;
            }

            if (block_data['type'] == "graph"){
                diff['graphJSON'] = block.graphJSON();
                diff['graphType'] = block.graphType();
                diff['graphConfig'] = block.graphConfig();
            }

            if(block_data['type'] == "ExternalResource"){
                diff['oembed_response'] = block_data['oembed_response'];
            }

            if (diff['slides'] != undefined){
                delete diff['slides'];
            }

            var update_data = {
                'res': JSON.stringify(diff),
                'resource_id': block.resourceID(),
                'type': block_data['type']
            }
            if (unlock === true) {
                update_data['unlock'] = true;
            }
            console.log('** UPDATE DATA **', update_data);
            block.guardando(true);
            $.ajax({
                url: editor_model.resources_url(),
                type: "POST",
                async: false,
                headers: {'X-HTTP-Method-Override': 'UPDATE'},
                data: update_data,
                success: function (data) {
                    /*if (unlock === true) {
                        console.log('UNLOCK SAVE TRUE');
                        block.locked(false);
                        block.locked_por('');
                    }*/
                    console.log('-- update block in DB --');
                    if(self.type == 'Section'){
                        //self.editSecRes(block);
                    }
                    block.guardando(false);
                }
            });
        }

        if(!self.multipleBlocksSelected) {
            block.metadata(editor_model.makeJson());
        }

    };
    
    this.editSecRes = function(block){
        var data = {
            sec_pk : self.containerID,
            res_pk: block.resourceID(),
            style: block.style()
        };
        console.log('-- try edit sec/res --');
        $.ajax({
            url: "/api/resource/edit_secres/",
            type: "POST",
            data: data,
            success: function (data) {
                console.log('-- success edit sec/res --');
            }
        });
    };
    
    //Investigar si hay alternativa al selector de jQuery...
    this.clearActiveBlock = function(unlock, meta_aux){
        var block = self.currentActiveBlock();
        if (block == null){ return; }
        if (block.type =='math' && block.mathVisible()){ block.editable(false); return; }
        editor_model.isOneGroup(true);
        editor_model.is_group(false);
        if (unlock === undefined) unlock = true;
        if (meta_aux === undefined) meta_aux = true;
        if (block != null && unlock && block.locked() && self.save_to_url()) {
            $.ajax({
                url: editor_model.resources_url(),
                type: "POST",
                data: {'resource_id':block.resourceID(), 'action':'unlock'},
                success: function (data) {
                    if (unlock){
                        //block.locked(false);
                        block.locked_por('');
                    }
                    console.log('-- block UNLOCKED --');
                }
            });
        }

        if(block != null && block.wrappingGroup && block.wrappingGroup.length){
            if(block.type == 'text'){
                for(var i = 0; i<block.wrappingGroup.length; i++){
                    self.unlockBlock(block.wrappingGroup[i]);
                }
            }else{
                self_id = block.wrappingGroup[0];
                self.unlockBlock(self_id);
                block_aux = self.getBlockById(self_id);
                for (var i=0; i<block_aux.wrappingGroup.length; i++){
                    if(block_aux.wrappingGroup[i] != block.resourceID()){
                        self.unlockBlock(block_aux.wrappingGroup[i]);
                    }
                }
            }
        }

        if(block != null && block != 'multiple'){
             block.activeBlock(false);
             block.draggable(false);
             block.editable(false);
             if(block.type == 'gallery' || block.type == 'slider'){ block.activeSlider(true); }
             if(block.type == 'text' || block.type == 'figuras_geo'){ block.resizable(false); }
             editor_model.activeBlock('editor');

            console.log("CLEAR - a: "+block.activeBlock()+", d: "+block.draggable()+", e:"+block.editable());

             self.currentActiveBlock(null);
             self.showInlineEditor(false);
             self.enableSelectable();
        }else{
            if(meta_aux && block != 'multiple' && self.save_to_url()) {
                editor_model.saveMetadata(true);
                if ($('#editor_title').is(":focus")) $('#editor_title').blur();
            }
        }
        
        if(block == 'multiple') self.clearMultipleSelection();
        self.currentActiveBlock(null);
        self.showInlineEditor(false);
        self.enableSelectable();

        //Se hace el json de metadatos.
        if (self.save_to_url()){
            editor_model.restoreJson(editor_model.metadata());
        }
    };
    
    this.clearMultipleSelection = function(){
        self.savingMultiple = $('.ui-selected').length;
        $('.ui-selected').draggable('destroy');
        $('.ui-selected').each(function(){
            var block = ko.dataFor(this);
            self.saveBlockInDB(block, $(this), true);
        });
        $('.ui-selected').removeClass('ui-selected');
        $('.editor_group').each(function(){
            group_block = ko.dataFor($(this)[0]);
            self.unlockBlock(group_block.resourceID());
        });
        self.multipleBlocksSelected = false;
        editor_model.width(0);
        editor_model.activeBlock('editor');
        self.currentActiveBlock(null);
    };
    
    this.sendBlockProperties = function(){
        editor_model.left(parseInt($(".active-block").css("left")));
        editor_model.top(parseInt($(".active-block").css("top")));
        editor_model.multipleSelection(false);  
        editor_model.zIndex(parseInt($(".active-block").css("z-index")));
        $('#zRange').change();
    };

    this.sendMultipleProperties = function(){
        var reference = $('.ui-selected').first();
        left          = parseInt($(reference).css("left"));
        top           = parseInt($(reference).css("top"));


        if ($('.ui-selected').length > 1){
            editor_model.width(0);
            editor_model.height(0);
        }else{
            editor_model.width(parseInt($(reference).width()));
            editor_model.height(parseInt($(reference).height()));
        }

        //moduleContext.notify('MULTIPLE_INFO', info);  
        editor_model.left(left);
        editor_model.top(top);
        editor_model.lastLeft = left;
        editor_model.lastTop  = top;
        editor_model.multipleSelection(true);
    };
    
    this.sendTextBlockProperties = function(){
        var element = self.currentActiveBlock().type != 'text' ? $('.active-block .image-caption'):$('.active-block .editable-div');
        var blockHtml = $(element).html();
        editor_model.background(self.getColorProperty('background-color', $(element), '-'));
        editor_model.color(self.getColorProperty('color', $(element), '-'));
        editor_model.face(self.getProperty('font-family', $(element), 'nv'));
        editor_model.size(self.getProperty('font-size', $(element), 'nv'));
        current =  self.currentActiveBlock();
        if (current.type == 'text' && current.wrappingGroup != undefined && current.wrappingGroup.length){
            editor_model.is_group(true);
        }
    };
    
    this.getProperty = function(property, block, nv){       
        var value = nv;
        var isFirst = true;
        var elements = $(block).find('font, span, p');
        for(var i=0; i<elements.length; i++){
            var raw = $(elements[i]).css(property);
            var auxp = raw.search(/,\s/) != -1 ? null:raw;
            if(isFirst && auxp){
                value = auxp;
                isFirst = false;
            }
            if(!isFirst && auxp != value) return nv;
        }
        return value;
    };
    
    this.getColorProperty = function(property, block, nv){
        var color;
        if(property == 'background-color') {
            color = $(block).css(property);
            if(!color){ return nv; }
        } else {
            color = $(block).find('font, span, p').css(property);
            if(!color){ return nv; }
            var fonts = $(block).find('font, span, p'); 
            for(var i=1; i<fonts.length; i++){
                if($(fonts[i]).css(property) != color){
                    return nv;
                }
            }
        }
        return color;
    };
    
    this.sendImageBlockProperties = function(domBlock){
        var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
        
        var rotate = domBlock.attr("data-rotate");
        if (rotate == undefined) { rotate = 0; }
        
        var element = domBlock.find('.image');
        editor_model.width(element.width());
        editor_model.height(element.height());
        editor_model.borderWidth(parseInt(element.css("border-width")));
        editor_model.borderColor(element.css("border-color"));
        editor_model.rotate(rotate);
        editor_model.aspectRatio(self.aspectRatio);
    };
    
    this.sendSVGBlockProperties = function(domBlock){
        var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
        
        var element = domBlock.find('svg').children().first();
        var stroke_w = typeof element.attr("stroke-width") !== 'undefined' ? parseInt(element.attr("stroke-width")) : 1;
        var stroke = typeof element.attr("stroke") !== 'undefined' ? element.attr("stroke") : '#000';
        var rotate = typeof domBlock.data("rotate") !== 'undefined' ? domBlock.data("rotate") : 0;
        var fill = typeof element.attr("fill") !== 'undefined' ? element.attr("fill") : '#fff';

        editor_model.borderWidth(stroke_w);
        editor_model.borderColor(stroke);
        editor_model.rotate(rotate);
        editor_model.fillColor(fill);
    };
    
    this.sendCaptionProperties = function(){
        editor_model.showCaption(self.currentActiveBlock().captionVisible());
        editor_model.posCaption(self.currentActiveBlock().captionPosition());
        if(self.currentActiveBlock().type != 'table') self.sendTextBlockProperties();
    };

    this.sendFileProperties = function(){
        editor_model.name(self.currentActiveBlock().file_name());
    };

    this.sendGraphProperties = function(){
        if (self.currentActiveBlock().graphConfig() != null){
            var show_title = self.currentActiveBlock().graphConfig()['meta']['showCaption'] == undefined ? true : self.currentActiveBlock().graphConfig()['meta']['showCaption'];
            var bg_color = self.currentActiveBlock().graphConfig()['graph']['bgcolor'] == undefined ? '#FFF' : self.currentActiveBlock().graphConfig()['graph']['bgcolor'];
            var palette = self.currentActiveBlock().graphConfig()['graph']['palette'] == undefined ? 'Default' : self.currentActiveBlock().graphConfig()['graph']['palette'];
            var x_axis = self.currentActiveBlock().graphConfig()['meta']['hlabel'] == undefined ? '' : self.currentActiveBlock().graphConfig()['meta']['hlabel'];
            var y_axis = self.currentActiveBlock().graphConfig()['meta']['vlabel'] == undefined ? '' : self.currentActiveBlock().graphConfig()['meta']['vlabel'];
            var legend = self.currentActiveBlock().graphConfig()['legend'] == undefined ? 'bottom' : self.currentActiveBlock().graphConfig()['legend']['position'];
            var orientation = self.currentActiveBlock().graphConfig()['graph']['orientation'] == undefined ? 'Vertical' : self.currentActiveBlock().graphConfig()['graph']['orientation'];
            editor_model.showGraphTitle(show_title);
            editor_model.background(bg_color.substr(1));
            editor_model.palette(palette);
            editor_model.x_axis(x_axis);
            editor_model.y_axis(y_axis);
            editor_model.legend_pos(legend);
            editor_model.graphOrientation(orientation);
            editor_model.graphType(self.currentActiveBlock().graphType());
        }
    }
    
    this.sendLatex = function(){
        if(self.currentActiveBlock().type == 'math'){
            l_code = $('.active-block').find('.latex-hidden').html();
            $('#latex-textarea').val(l_code);
        }
    };

    this.sendCaption = function(){
        if(self.currentActiveBlock().type == 'math'){
            c_code = $('.active-block').find('.editable-div').find('font').html();
            $('#caption-textarea').val(c_code);
        }
    }

    this.sendTableBlockProperties = function(){
        var crows = $('.active-block').find('tr').length;
        var ccolumns = 0;
        $('.active-block').find('tr').first().find('td').each(function(){
            ccolumns++;
            if($(this).attr('colspan')){
                ccolumns += parseInt($(this).attr('colspan')) - 1; 
            }
        });
        editor_model.rows(crows);
        editor_model.columns(ccolumns);
        /*self.tableBorderWidth(blockInfo.borderWidth);
        self.tableBorderColor(blockInfo.borderColor);*/
        editor_model.face(self.getTableProperty('font-family', $('.active-block').find('table'), 'nv'));
        editor_model.size(self.getTableProperty('font-size', $('.active-block').find('table'), 'nv'));
        editor_model.color(self.getTableProperty('color', $('.active-block').find('table'), '-'));
        editor_model.background(self.getTableProperty('background-color', $('.active-block').find('table'), '-'));
    };
    
    this.sendTabsBlockProperties = function(){
        var blockInfo = {
            "tabs": $('.active-block').find('.tabs ul li').length,
        };
        moduleContext.notify('BLOCK_INFO_TABS', blockInfo);
    };
    
    this.sendMediaBlockProperties = function(){
        editor_model.url(self.currentActiveBlock().url);
        //moduleContext.notify('BLOCK_INFO_MEDIA', blockInfo);
    };
    
    this.sendSwiperBlockProperties = function(){
        //moduleContext.notify('BLOCK_INFO_SWIPER', blockInfo);
        editor_model.showThumbnails(self.currentActiveBlock().swiperThumbnailsVisible());
    };
    
    this.sendModalBlockProperties = function(){
        //moduleContext.notify('BLOCK_INFO_MODAL', blockInfo);
        editor_model.triggerText(self.currentActiveBlock().buttonText());
    };
    
    this.sendButtonBlockProperties = function(){
        selectedAnchor = self.currentActiveBlock().buttonAnchor;
        //moduleCoçntext.notify('BLOCK_INFO_BUTTON', blockInfo);
        editor_model.buttonText(self.currentActiveBlock().buttonText());
        editor_model.blocksAnchors(self.getAnchors());
        console.log('SELECTED ANCHOR', selectedAnchor);
        if(selectedAnchor){
            $('#buttonOpt2 option[value="' + selectedAnchor + '"]').prop('selected', true);
        } else {
            $('#buttonOpt2 option:eq(0)').prop('selected', true);
        }
    };
    
    this.sendQuizbBlockProperties = function(block){
        var block = typeof block !== 'undefined' ? block : self.currentActiveBlock();
        editor_model.quizbText(block.buttonText());
    };
    
    this.getAnchors = function(){
        var ids = new Array();
        ids.push(new SelOption(0,'Selecciona un recurso'));
        for(var i=0; i<self.blocks().length; i++){
            if(self.blocks()[i].resourceID != self.currentActiveBlock().resourceID && self.blocks()[i].type != 'button' && self.blocks()[i].type != 'modal'){
                var otext = self.blocks()[i].type; 
                console.log(self.blocks()[i].title);
                if(self.blocks()[i].title != null && self.blocks()[i].title != 'null'){
                    otext += ' - ' + self.blocks()[i].title;
                }
                ids.push(new SelOption(self.blocks()[i].resourceID(), otext));
            }
        }   
        return ids;
    };
    
    this.getTableProperty = function(property, table, nv){
        var selectedCells = self.getSelectedCells(table);
        var value = $(selectedCells[0]).css(property);
        for(var i=1; i<$(selectedCells).length; i++){
            if($(selectedCells[i]).css(property) != value) return nv;
        }
        return value;
    };
    
    this.applyCommand = function(command, value){
        if(!$(".active-block")) return false;
        //verifyTextStructure();
        value = command == 'font-size' ? pxConversion[value]:value;
        command = commandConversion[command] ? commandConversion[command]:command;
        command = command == 'text-align' ? valueConversion[value]:command;
        console.log('command',command);
        console.log('value',value);
        
        if(command == 'backcolor'){
            if($('.active-block').find('.editable-div .sy-tb-container').length > 0){
                $('.active-block').find('.editable-div .sy-tb-container').css('background','#'+value);
            } else {
                $('.active-block').find('.image-caption, .editable-div').first().css('background','#'+value);
            }
            return false;
        }
        if(command == 'justifyfull'){
            if($('.active-block').find('.editable-div .sy-tb-container').length > 0){
                $('.active-block').find('.editable-div .sy-tb-container').css({'text-align':'justify'});
            } else {
                $('.active-block').find('.image-caption, .editable-div').first().css({'text-align':'justify'});
            }
            return false;
        }
        if(command == 'justifyleft'){
            if($('.active-block').find('.editable-div .sy-tb-container').length > 0){
                $('.active-block').find('.editable-div .sy-tb-container').css({'text-align':'left'});
            } else {
                $('.active-block').find('.image-caption, .editable-div').first().css({'text-align':'left'});
            }
            return false;
        }
        if(command == 'justifyright'){
            if($('.active-block').find('.editable-div .sy-tb-container').length > 0){
                $('.active-block').find('.editable-div .sy-tb-container').css({'text-align':'right'});
            } else {
                $('.active-block').find('.image-caption, .editable-div').first().css({'text-align':'right'});
            }
            return false;
        }
        if(command == 'justifycenter'){
            if($('.active-block').find('.editable-div .sy-tb-container').length > 0){
                $('.active-block').find('.editable-div .sy-tb-container').css({'text-align':'center'});
            } else {
                $('.active-block').find('.image-caption, .editable-div').first().css({'text-align':'center'});
            }
            return false;
        }
        
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
    
    this.tableApplyCommand = function(command, value){
        var cells = self.getSelectedCells($('.active-block').find('table'));
        var isAppliedToAll = true;
        
        for(var i=0; i<cells.length; i++){
            if($(cells[i]).css(command) != value){
                isAppliedToAll = false;
                break;  
            }
        }
        console.log('isAppliedToAll',isAppliedToAll);
 
        if(!isAppliedToAll){
            cells.css(command,value);
        } else {
            if(command == 'font-weight' || command == 'font-style')
                cells.css(command, 'normal');
            if(command == 'text-align')
                cells.css(command, 'left'); 
        }
        self.updateCellHelper();
    };
    
    this.loadBlocksFromDB = function(){
        showLoading();
        $.ajax({
            url: editor_model.resources_url(),
            type: 'GET',
            success: function(msg){
                console.log('** resources retrieved successfully **');
                console.log(msg);
                //self.containerID = msg.id;
                for(var i=0; i<msg.length; i++){
                    if ( 'locked_resources' in msg[i]){
                        for (var j=0; j<msg[i]['locked_resources'].length; j++){
                            var locked_locker_arr = msg[i]['locked_resources'][j]['locker'].split(':');
                            if (locked_locker_arr.length == 2){
                                var locked_locker_id = locked_locker_arr[1];
                                var locked_locker = locked_locker_arr[0];
                            }else{
                                var locked_locker_id = 0;
                                var locked_locker = '';
                            }
                            block = self.getBlockById(msg[i]['locked_resources'][j]['resource']);
                            block.locked(true);
                            block.locked_por(locked_locker);
                            block.locked_id(locked_locker_id);
                        }
                    }else{
                        self.restoreBlock(msg[i]);
                    }
                }
                resizeCanvas($('.main-editor'));
                if (self.preview){
                    $("[contenteditable]").each(function(){$(this).removeAttr('contenteditable');});
                    $('.cmodal-title').each(function(){$(this).attr('disabled', true)});
                    $('.cmodal-content').each(function(){$(this).attr('disabled', true)});
                    $('.ui-dialog').css('z-index', 1002);
                    $('#editor-wrapper').css('background', 'none');
                    $('.block').on('click', function(e){
                        if($(this).data('type') == 'file'){
                            e.preventDefault();
                            var file_block = ko.dataFor($(this)[0]);
                            window.open(file_block.url, '_blank');
                        }
                    });
                }
                hideLoading();
            }
        });
    };
    
    this.deleteBlockInDB = function(block){
        if (!self.save_to_url()) {
            return;
        }
        data = {
            resource_id: block.resourceID(),
        };
        console.log('** delete block in db **');
        console.log(data);
        if(self.containerID){
            $.ajax({
                url: editor_model.resources_url(),
                type: 'POST',
                headers: {'X-HTTP-Method-Override': 'DELETE'},
                data: data,
                success: function(msg){
                    console.log('-- delete block in DB --');
                }
            });
        }
    };
    
    this.removeBlock = function(domBlock){
        var domBlock = typeof domBlock !== 'undefined' ? domBlock : $('.active-block')[0];
        var block = ko.dataFor(domBlock);
        var canvas = $(domBlock).parent();
        console.log('** remove block **');
        wrap_group = block.wrappingGroup
        if ( wrap_group != undefined && wrap_group.length && block.type != 'text'){
            related_group = ko.dataFor($('#'+wrap_group[0])[0]);
            index_of = related_group.wrappingGroup.indexOf(block.resourceID());
            if (index_of != -1){
                related_group.wrappingGroup.splice(index_of, 1);
                linkedBlocksDom = new Array();
                for (var i=0; i<related_group.wrappingGroup.length; i++){
                    linkedBlocksDom.push($('#'+related_group.wrappingGroup[i]));
                }
                wrapText(related_group, related_group.wrappingGroup, $('#'+wrap_group[0]), linkedBlocksDom);
                self.saveBlockInDB(related_group, $('#'+wrap_group[0]));
            }
        }else if(wrap_group != undefined && block.type == 'text') {
            for ( var i = 0; i < wrap_group.length; i++){
                rel_block = ko.dataFor($('#'+wrap_group[i])[0]);
                rel_block.wrappingGroup = new Array();
                self.saveBlockInDB(rel_block, $('#'+wrap_group[i]))
            }
        }
        if(block.resourceID()){
            self.deleteBlockInDB(block);
        }
        if(!self.multipleBlocksSelected) self.clearActiveBlock(false);
        self.blocks.remove(block);
        resizeCanvas(canvas);
    };
    
    this.embedMedia = function(data, block, domBlock){
        if(typeof data === 'undefined' || data == null) return false;
        var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
        var block = typeof block !== 'undefined' ? block : self.currentActiveBlock();
        
        if (typeof(data)!='string' && (block.type == "image" || block.type == 'gallery') && data.type!='photo'){
            alert('No se puede usar la dirección o el recurso especificado. Revise la dirección (URL) y la existencia del recurso que se intenta incluir e intente de nuevo.');
            return;
        }
        if(block.type != 'image' && block.type != 'gallery' && (!data.html || !data.thumbnail_url) ){
            alert('No se puede usar la dirección o el recurso especificado. Revise la dirección (URL) y la existencia del recurso que se intenta incluir e intente de nuevo.');
            return;
        }
        
        domBlock.find('.empty').removeClass('empty');
        var thumbnail = domBlock.find('.thumbnail').first();
        var media     = domBlock.find('.media').first();
        var image     = domBlock.find('.image').first();
        var type = 'photo';
        if(block.type != 'image' && block.type != 'gallery'){
            type = block.type;
        }
        block.url = data.url; 
        block.title = data.title;
        block.oembed_response = data;
        
        if(block.type == "image") {
            domBlock.find('.ajax-loader-container').show();
            if (typeof(data)=='string'){
                domBlock.find('.image img').attr('src', data);
            } else {
                domBlock.find('.image img').attr('src', data.url)
            }
            domBlock.find('.image img').first().hide();
            domBlock.css({"width": "", "height":""});
            domBlock.find('.image img').first().load(function(){
                domBlock.find('.ajax-loader-container').hide();
                domBlock.find('.image img').show();
                self.adaptAfterInsert(domBlock);
                self.sendImageBlockProperties();
            }); 
            block.resizable(false);
            block.resizable(true);
            block.isExternal = true;
            try{
                applyBindingsToImageBlock(block, domBlock[0]);
            } catch(e) {}
        } else if(block.type == "gallery") {
            var content = '<img src="' + data.url + '">';
            var newSlide = self.currentActiveSlider.createSlide(content);
            newSlide.append();
        } else {
            var cheight = 270;
            var cwidth  = 480;
            if(block.type == "audio"){
                cheight = 220;
                cwidth  = 220;
            }
            
            var html = data.html.replace(/src="\/\//g,'src="http://');
            media.html(html);
            
            thumbnail.prepend('<img src="'+data.thumbnail_url+'">');
            thumbnail.find('img').load(function(){
                media.css("height",cheight);
                media.css("width",cwidth);
                thumbnail.css("height",cheight);
                thumbnail.css("width",cwidth);
                media.find('iframe').css("height",cheight);
                media.find('iframe').css("width",cwidth);
                
                var thumb_height = thumbnail.find('img').height();
                var media_height = media.find('iframe').height();
                if(thumb_height > media_height){
                    thumbnail.find('img').css('margin-top',(thumb_height-media_height)/-2);
                }
                thumbnail.css('height',cheight);
                
                block.isExternal = true;
                domBlock.find('.ajax-loader-container').hide();
                applyBindingsToMediaBlock(block, domBlock[0]);
            });
        }
    };

    this.manageTable = function(command, value){
        value = parseInt(value);
        var newCell = '<td style="font-family: Cabin; font-size: 13px; color: #000000; background-color: #ffffff; border: 1px solid; border-color: #'+self.tableBorder+'; width: 80px;">Celda</td>';
        var crows = $('.active-block').find('tr').not('.resizing-row').length;
        var ccolumns = 0;
        $('.active-block').find('tr').first().find('td').each(function(){
            ccolumns++;
            if($(this).attr('colspan')){
                ccolumns += parseInt($(this).attr('colspan')) - 1; 
            }
        });
        if(command == 'rows'){
            while(crows != value){
                if(crows > value){
                    $('.active-block').find('tbody').children('tr').last().remove();
                    crows--;
                } else {
                    var content = '<tr>';
                    for(var i=0; i<ccolumns; i++){
                        content += newCell;
                    }
                    content += '</tr>';
                    var lastRow = $('.active-block').find('tbody').append(content);
                    crows++;
                }
            }
        } else {
            while(ccolumns != value){
                if(ccolumns > value){
                    $('.active-block').find('tbody').children('tr').each(function(){
                        $(this).children().last().remove();
                    });
                    ccolumns--;
                } else {
                    $('.active-block').find('tbody').children('tr').each(function(){
                        $(this).append(newCell);
                    });
                    ccolumns++;
                }
            }
        }
        // Para que se puedan aplicar los eventos a las celdas nuevas.
        self.currentActiveBlock().editable(false);
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
    
    this.createTableFromString = function(content){
        var html = '<table class="ctable top-caption-ref bot-caption-ref" data-bind="ctable: activeBlock() && editable()">';
        var rows = content.split("\n");
        for(var i=0; i<rows.length; i++){
            var row = rows[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            html += '<tr>';
            for(var j=0; j<row.length; j++){
                html += '<td style="font-family: Cabin; font-size: 13px; color: #000000; background-color: #ffffff; border: 1px solid; border-color: #d9dad9; width: 80px;">' + 
                            row[j].trim().replace(/(^")(?=[^"])|(?![^"])("$)|^""$/g,'').replace(/""/g,'"') + 
                        '</td>';
            }
            html += '</tr>';
        }
        html += '</tbody></table>' +
                '<div class="image-caption box-sizing-border-box" data-bind="ceditor: true, ccaption: activeBlock(), visible: captionVisible()">' +
                    '<div class="editable-div" contenteditable="true">' + 
                        '<font color="#000000" style="background-color: none; font-family: Arial; font-size: 13px;">' +
                            'Escribe un texto aquí' + 
                        '</font>' + 
                    '</div>' + 
                '</div>';

        $('.active-block').html(html);
        self.defineTable();
    }
    
    this.manageTabs = function(tabs){
        var ctabs = $('.active-block').find('.tabs ul li').length
        while(ctabs != tabs){
            if(ctabs > tabs){
                $('.active-block').find('.tabs ul li').last().remove();
                $('.active-block').find('.tabs div').last().remove();
                ctabs--;
            } else {
                ctabs++;
                var liContent  = '<li><a href="#fragment-' + ctabs + '" contenteditable>' +
                                    'Pestaña ' + ctabs + '</a></li>';
                var divContent = '<div id="fragment-' + ctabs + '" contenteditable>' + 
                                    'Contenido ' + ctabs + '</div>';
                $('.active-block').find('.tabs ul li').last().after(liContent);
                $('.active-block').find('.tabs div').last().after(divContent);
            }
        }
        $('.active-block').tabs('refresh');
    }
    
    this.showMediaSelector = function(value, type){
        console.log('****---****---***',value,type);
        var type = typeof type !== 'undefined' ? type : null;
        //moduleContext.notify('SHOW_MEDIA_SELECTOR', obj);
        editor_model.activeBlock(type);
        tipo = editor_model.activeBlock();
        editor_model.showMediaSelector(value);
    };
    
    this.showQuizConfig = function(value){
        //moduleContext.notify('SHOW_QUIZ_CONFIG', value);
        editor_model.showQuizConfig(value); 
    };
    
    this.showPracticeConfig = function(value){
        //moduleContext.notify('SHOW_QUIZ_CONFIG', value);
        editor_model.showPracticeConfig(value); 
    };

    //Sólo para imágenes...
    this.adaptAfterInsert = function(element){
        var wrapper = $(element).parent();
        var width   = wrapper.width();
        var height  = wrapper.height();
        
        var newImg = new Image();
        newImg.onload = function() {
            var nwidth = newImg.width > width/2 ? width/2:newImg.width;
            $(element).find('.image').css({'width':nwidth});
            $('.active-block').find('.image-caption').css('width', nwidth);
            resizeCanvas($(element).parent());
        }
        newImg.src = $(element).find('.image img').attr('src');
    };
    
    this.defineImage = function(media_url, file_name, block, domBlock, inner_style, flip_h, flip_v){
        var block = typeof block !== 'undefined' ? block : self.currentActiveBlock();
        var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
        var inner_style = typeof inner_style !== 'undefined' ? inner_style : null;
        var flip_h = typeof flip_h !== 'undefined' ? flip_h : false;
        var flip_v = typeof flip_v !== 'undefined' ? flip_v : false;
        
        domBlock.css({"width": "", "height":""});
        domBlock.find('.empty').removeClass('empty');
        domBlock.find('.ajax-loader-container').show();
        domBlock.find('.image img').first().hide();
        domBlock.find('.image img').attr('src', media_url);
        domBlock.find('.image img').on('load', function(){
            domBlock.find('.ajax-loader-container').hide();
            domBlock.find('.image img').show();
            if(inner_style != null) {
                domBlock.find('.image').attr('style', inner_style);
            } else {
                self.adaptAfterInsert(domBlock);
            }
            
            if(flip_h && !flip_v) domBlock.find('.image').addClass('flip-h');
            if(!flip_h && flip_v) domBlock.find('.image').addClass('flip-v');
            if(flip_h && flip_v) domBlock.find('.image').addClass('flip-both');
            
            var width = $(this).outerWidth();
            self.sendImageBlockProperties();
        }); 
        
        block.url = media_url;
        block.title = file_name;
        if(!block.resourceID()) block.isClone = true;
        try {
            applyBindingsToImageBlock(block, domBlock[0]);
        } catch (e){}
    };
    
    this.defineMedia = function(media_type, media_url, file_name, block, domBlock){
        var block = typeof block !== 'undefined' ? block : self.currentActiveBlock();
        var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
        
        domBlock.find('.empty').removeClass('empty');
        domBlock.find('.media, .thumbnail').html('');

        $('<iframe />').appendTo(domBlock.find('.media'));
        var thumbnail = media_type == 'video' ? "<img class='video-sample-thumbnail' src='{% static 'theme/dark/icons/video_thumb.png' %}'>" : "<img class='audio-sample-thumbnail' src='{% static 'theme/dark/icons/audio_thumb.png' %}'>";                        
        domBlock.find('.thumbnail').append(thumbnail);
        block.content(getContent(domBlock));
        domBlock.find('.ajax-loader-container').hide();
        domBlock.find('.thumbnail').show();
        
        var iframe = domBlock.find('iframe');
        loadMediaPlayer(media_url, media_type, iframe);             
        applyBindingsToMediaBlock(block, domBlock[0]);
        
        block.url = media_url;
        block.title = file_name;
        if(!block.resourceID()) block.temporalVersion = JSON.stringify(self.getBlockData(block));
    };

    this.defineSVGActiveBlock = function(response){
        response = JSON.parse(response);
        $('.active-block').html('');
        $('.active-block').append(response.svg_content);
    };

    this.defineFileActiveBlock = function(response){
        response = JSON.parse(response);
        $('.active-block').find('.empty').removeClass('empty');
        self.currentActiveBlock().url = response.media_url;
        self.currentActiveBlock().title = response.file_name;
        self.currentActiveBlock().file_name(response.file_name);
        var doc_type = "{% static 'theme/dark/icons/txt_file.png' %}";
        if (response.media_url.endsWith('.doc') || response.media_url.endsWith('.docx')){
            doc_type = "{% static 'theme/dark/icons/doc.png' %}";
        }
        if (response.media_url.endsWith('.pdf')){
            doc_type = "{% static 'theme/dark/icons/pdf.png' %}";
        }
        $('.active-block').find('img').attr('src',doc_type);
        //$('.active-block').find('.doc_name').html(response.file_name);
        $('.active-block').find('.file_url').html(response.media_url);
        self.sendFileProperties();
        try{
            ko.applyBindings(self.currentActiveBlock(), $('.active-block').find('.doc_name')[0]);
        }catch(err){}
    };

    this.defineImagesSlider = function(images, block, domBlock){
        var block = typeof block !== 'undefined' ? block : self.currentActiveBlock();
        var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
        
        if (!(images instanceof Array)){ images = [images]; }
        domBlock.find('.empty').removeClass('empty');

        var aux = self.currentActiveSlider.slides.length;
        for(var i=0; i<images.length; i++){
            var image = typeof images[i].contenido !== 'undefined' ? JSON.parse(images[i].contenido) : JSON.parse(images[i]);
            var content = '<img src="' + image.media_url + '">';
            if(block.type == 'slider'){
                var caption = typeof images[i].text !== 'undefined' ? images[i].text : '';
                content +=  '<div class="cslide-caption-container">' + 
                                '<div class="cslide-caption editable-div" contenteditable="true" contenteditable=true placeholder="Escribe un texto aquí">' + caption + '</div>' + 
                            '</div>';
            }
            var newSlide = self.currentActiveSlider.createSlide(content);
            newSlide.append();
            block.containedResources.push({
                contenido: '{"file_name":"' + image.file_name + '","media_url":"' + image.media_url + '"}',
                order: i+aux,
                style: '',
                text: null
            });
            var thumb = '<div class="swiper-thumbnail left" data-slide="' + (i+aux) + '" data-bind="setSwiperThumbnail: true"><img src="' 
                            + image.media_url + '"></div>';
            domBlock.find('.swiper-thumbnails').append(thumb);
        }
        self.currentActiveSlider.reInit();
        self.currentActiveSlider.swipeTo(0,0,false);
        block.activeSlider(true); 
        block.activeSlider(false);
        ko.applyBindings(block, domBlock.find('.swiper-thumbnails')[0]);
    };
    
    this.manageSlides = function(slides){
        console.log('--- MANAGE SLIDES ---');
        console.log(slides);

        $('.active-block').find('.empty').removeClass('empty');
        self.currentActiveSlider.removeAllSlides();
        self.currentActiveBlock().containedResources = new Array();
        $('.active-block .swiper-thumbnail').remove();
        for(var i=0; i<slides.length; i++){
            var newSlide = self.currentActiveSlider.createSlide(slides[i].content);
            newSlide.append();
            self.currentActiveBlock().containedResources.push({
                contenido: JSON.stringify({'file_name':'', 'media_url':slides[i].url}),
                order: i,
                style: '',
                text: slides[i].text
            });
            var thumb = '<div class="swiper-thumbnail left" data-slide="' + i + '" data-bind="setSwiperThumbnail: true"><img src="' + slides[i].url + '"></div>';
            $('.active-block .swiper-thumbnails').append(thumb);
        }
        self.currentActiveSlider.reInit();
        self.currentActiveSlider.swipeTo(0,0,false);
        self.currentActiveBlock().activeSlider(true); 
        self.currentActiveBlock().activeSlider(false);
        $('.active-block .swiper-thumbnail').each(function(){
            try{
                ko.applyBindings(self.currentActiveBlock(), this);
            }catch(err) {
                console.log('Multiple Bindings');
            }
            
        });
    };
    
    this.defineModal = function(button_text, title, html, block, domBlock){
        var openModal = typeof block === 'undefined' && typeof domBlock === 'undefined' ?  true : false;
        var button_text = typeof button_text !== 'undefined' ? button_text : 'Texto del Botón';
        var title = typeof title !== 'undefined' ? title : '';
        var html = typeof html !== 'undefined' ? html : '';
        var block = typeof block !== 'undefined' ? block : self.currentActiveBlock();
        var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
        
        block.cModalTitle(title);
        block.cModalContent(html);
        block.buttonText(button_text);

        ko.applyBindings(self, domBlock.find('.dialog-buttons')[0]);
        ko.applyBindings(self, domBlock.find('.bhelper1')[0]);
        ko.applyBindings(self, domBlock.find('.bhelper2')[0]);
        ko.applyBindings(block, domBlock.find('.cmodal-button-text')[0]);
        ko.applyBindings(block, domBlock.find('.cmodal-title')[0]);
        ko.applyBindings(block, domBlock.find('.cmodal-content')[0]);
        
        if(!openModal) domBlock.find('.empty').removeClass('empty');
        self.updateButtonText(button_text, domBlock);
        var modal = domBlock.find(".cmodal");
        domBlock.find('.regresar-modal').click(function(){
            var code_content = editor_viewer.getValue();
            block.cModalContent(code_content);
            editor_viewer.toTextArea();
            applyTinyMCE(modal);
            $(this).hide();
            tinyMCE.activeEditor.setContent(block.cModalContent());
        });
        
        modal.dialog({autoOpen: false, modal: true, resizable: false, width: '700px'});
        $(modal).bind('dialogclose', function(event) {
            if($(modal).hasClass('empty')) self.removeBlock();
        });
        
        domBlock.find(".trigger").click(function(){
            modal.dialog("open");
            self.currentActiveModal = modal;
            if (!self.preview){
                applyTinyMCE(modal);
                tinyMCE.activeEditor.setContent(block.cModalContent());
            }else{
                var modal_content_elm = modal.find('.basic-modal-container:not(.top-section)');
                if (!modal_content_elm.find('iframe').length){
                    modal_content_elm.append('<iframe style="width:100%; border:none"></iframe>');
                    var bodyi = modal_content_elm.find('iframe').contents().find('body');
                    bodyi.html(block.cModalContent());
                    localVideos = bodyi.find('img.no_borrar');
                    localVideos.each(function(){
                        if (!$(this).width()){
                            $(this).width(200);
                        }
                        if (!$(this).height()){
                            $(this).height(150);
                        }
                        $(this).replaceWith('<video class="no_borrar" width="'+$(this).css('width')+'" height="'+$(this).css('height')+'" data-url="'+$(this).data('url')+'"controls><source src="'+$(this).data('url')+'" type="video/mp4"></video>')
                    });
                    externalVideos = bodyi.find('img.no_borrar_embed');
                    externalVideos.each(function(){
                        aux = $(this).data('url');
                        if (!$(this).width()){
                            $(this).width(200);
                        }
                        if (!$(this).height()){
                            $(this).height(150);
                        }
                        $(this).replaceWith('<iframe class="no_borrar_embed" data-url="'+aux+'" data-thumbnail="'+$(this).data('thumbnail')+'" src='+ aux+' width="'+$(this).css('width')+'" height="'+$(this).css('height')+'"></iframe>');
                        //$(this).replaceWith('<video width="'+$(this).css('width')+'" height="'+$(this).css('height')+'" controls><source src="'++'" type="video/mp4"></video>')
                    });
                    modal.find('.cmodal-content').hide();
                    modal.find('.top-section').hide();
                    var modal_title = modal.find('.cmodal-title').val();
                    modal.find('.cmodal-title').hide();
                    modal.find('.button:not(.contrast-2)').hide();
                    modal.parent().find('.ui-dialog-title').html(modal_title);
                    modal.find('.cmodal-button-text').attr('disabled', true);
                }
                $('.ui-widget-overlay').css('z-index', 1001);
            }
        });
        if(openModal) domBlock.find(".trigger").click();
    };
    
    this.defineButton = function(text, block, domBlock){
        var block = typeof block !== 'undefined' ? block : self.currentActiveBlock();
        var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
        domBlock.removeClass('empty');
        block.buttonText(text);
        ko.applyBindings(self, domBlock.find('.bhelper1')[0]);
        ko.applyBindings(self, domBlock.find('.bhelper2')[0]);
        self.updateButtonText(text,domBlock);
    };
    
    this.defineButtonAnchor = function(pid, block, domBlock){
        var block = typeof block !== 'undefined' ? block : self.currentActiveBlock();
        var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
        if(pid){
            domBlock.find('.button-anchor').attr('href', '#'+pid);
            block.buttonAnchor = pid;
        }
    }
    
    this.defineCaption = function(visible, text, position, size, style, block, domBlock){
        var style = typeof style !== 'undefined' ? style : '';
        var block = typeof block !== 'undefined' ? block : self.currentActiveBlock();
        var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
        var caption = domBlock.find('.image-caption');
        
        caption.attr('style',style);
        caption.find('.editable-div').html(text);
        if(position) {
            caption.insertAfter(domBlock.find('.bot-caption-ref'));
        } else {
            caption.insertBefore(domBlock.find('.top-caption-ref'));
        }
        if(size > 0) caption.css('width',size);
        
        block.captionVisible(visible);
        block.captionPosition(position);
        block.captionCustomSize(size);
    };
    
    this.defineQuiz = function(button_text, url, mas16, block, domBlock){
        var button_text = typeof button_text !== 'undefined' ? button_text : 'Cuestionario';
        var url = typeof url !== 'undefined' ? url : '#';
        var block = typeof block !== 'undefined' ? block : self.currentActiveBlock();
        var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
        
        domBlock.find('.empty').removeClass('empty');
        block.buttonText(button_text);
        block.goto_url(url);
        block.mas16(mas16);
        
        ko.applyBindings(self, domBlock.find('.bhelper1')[0]);
        ko.applyBindings(self, domBlock.find('.bhelper2')[0]);
        
        domBlock.find('.bhelper2').attr('href', url);
        self.updateButtonText(button_text, domBlock);
        self.sendQuizbBlockProperties(block);
    };
    
    this.updateButtonText = function(text, domBlock){
        var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
        domBlock.find('.bhelper1').html(text);
        domBlock.find('.bhelper2').html(text);
    };
    
    this.toggleBlockQuote = function(){
        if($('.active-block').html().search(/<blockquote/) != -1){
            var content = $('.active-block').find('blockquote').html();
            $('.active-block').find('.editable-div').html(content);
        } else {
            self.applyCommand('formatblock','blockquote');
        }
    };
    
    this.showThumbnailsActiveSwiper = function(value){
        self.currentActiveBlock().swiperThumbnailsVisible(value);
    };
    
    this.showCurrentActiveModal = function(value){
        if(value) {
            $(self.currentActiveModal).dialog('open');
        } else {
            if (!self.preview){
                var block = self.currentActiveBlock();
                if (tinyMCE.activeEditor == undefined){
                    var tiny_content = editor_viewer.getValue();
                }else{
                    var tiny_content = tinyMCE.activeEditor.getBody().innerHTML;
                }
                block.cModalContent(tiny_content);
            }
            $(self.currentActiveModal).dialog('close');
        }
    };
    
    this.removeEmptyClass = function(value){
        $(self.currentActiveModal).removeClass('empty');
    };
    
    this.mediaTrigger = function(block, event){
        console.log('BLOCK',block);
        block.mediaThumbnailVisible(false);
    };
    
    this.enableSelectable = function(){
        self.selectableEnabled(true);
    };
    
    this.disableSelectable = function(){
        console.log('Entre disable selectable');
        console.log($('.ui-selected'));
        $('.ui-selected').removeClass('ui-selected');
        self.selectableEnabled(false);
    };
    
    this.alignLeft = function(){
        $('.ui-selected').css('left',20);
    };
    
    this.alignVertical = function(){
        var blocks = $('.ui-selected');
        if(blocks.length < 2) return false;
        blocks.sort(function(a, b){
            return parseInt($(a).css('top')) - parseInt($(b).css('top'));
        });
        for(var i=1; i<blocks.length; i++){
            var top = parseInt($(blocks[i-1]).css('top')) + $(blocks[i-1]).outerHeight(true) + 5;
            $(blocks[i]).css('top', top);
        }
    };

    this.alignVerticalCenter = function(){
        var blocks = $('.ui-selected');
        if(blocks.length < 2) return false;
        var max_height = max_top = ab_top = max=0;
        blocks.sort(function(a, b){
            var a_h = $(a).height()!=undefined?$(a).height():0;
            var b_h = $(b).height()!=undefined?$(b).height():0;
            console.log('AH', a_h, b_h);
            if (a_h > b_h){
                max = a_h;
                ab_top = $(a).css('top');
            }else{
                max = b_h;
                ab_top = $(b).css('top');
            }
            console.log('mAx', max);
            if (max > max_height){
                console.log('mAx', max);
                max_height = max;
                max_top = ab_top;
            }
            return parseInt($(a).css('left')) - parseInt($(b).css('left'));
        });

        block_top = (max_height - $(blocks[0]).outerHeight())/2;
        $(blocks[0]).css('top', parseInt(max_top)+block_top);

        for(var i=1; i<blocks.length; i++){
            var left = parseInt($(blocks[i-1]).css('left')) + $(blocks[i-1]).outerWidth(true) + 5;
            $(blocks[i]).css('left', left);
            block_top = (max_height - $(blocks[i]).outerHeight())/2;
            $(blocks[i]).css('top', parseInt(max_top)+block_top);
        }
    };
    
    this.alignRight = function(){
        var blocks = $('.ui-selected');
        if(blocks.length < 1) return false;
        var rightLimit = $(blocks[0]).parent().width() - 20;
        for(var i=0; i<blocks.length; i++){
            var left = rightLimit - $(blocks[i]).outerWidth(true);
            $(blocks[i]).css('left', left);
        }
    };
    
    this.alignTop = function(){
        $('.ui-selected').css('top',20);
    };
    
    this.alignBottom = function(){
        var selBlocks = $('.ui-selected');
        var refValue = 805; // min-height - 20
        var blocks = $('.block');
        for(var i=0; i<blocks.length; i++){
            var value = parseInt($(blocks[i]).css('top'));
            if(value + $(blocks[i]).outerHeight() > refValue) refValue = value + $(blocks[i]).outerHeight();
        }
        $(selBlocks).each(function(){
            $(this).css('top', refValue - $(this).outerHeight());
        })
    };
    
    this.alignCenter = function(){
        var blocks = $('.ui-selected');
        if(blocks.length < 1) return false;
        var center = $(blocks[0]).parent().width() / 2;
        for(var i=0; i<blocks.length; i++){
            var left = center - $(blocks[i]).outerWidth(true)/2;
            $(blocks[i]).css('left', left);
        }
    };
    
    this.alignHorizontal = function(){
        var blocks = $('.ui-selected');
        if(blocks.length < 2) return false;
        blocks.sort(function(a, b){
            return parseInt($(a).css('left')) - parseInt($(b).css('left'));
        });
        for(var i=1; i<blocks.length; i++){
            var left = parseInt($(blocks[i-1]).css('left')) + $(blocks[i-1]).outerWidth(true) + 5;
            $(blocks[i]).css('left', left);
        }
    };
    
    this.alignGroup = function(dir){
        var blocks = $('.ui-selected');
        if(blocks.length < 2) return false;
        
        var inv = dir == 'bottom' || dir == 'right' ? true:false;
        dir = dir == 'bottom' ? 'top':dir;
        dir = dir == 'right' ? 'left':dir;
        
        var refValue = inv ? 0:9999;
        for(var i=0; i<blocks.length; i++){
            var value = parseInt($(blocks[i]).css(dir));
            if(!inv && (dir == 'left' || dir == 'top') && value < refValue) refValue = value;
            // Si es right
            if(inv && dir == 'left' && value + $(blocks[i]).outerWidth() > refValue) refValue = value + $(blocks[i]).outerWidth();
            // Si es bottom
            if(inv && dir == 'top' && value + $(blocks[i]).outerHeight() > refValue) refValue = value + $(blocks[i]).outerHeight();
        }
        
        if(!inv){
            $(blocks).css(dir, refValue);
        } else {
            $(blocks).each(function(){
                if(dir == 'left')
                    $(this).css(dir, refValue - $(this).outerWidth());
                else //top
                    $(this).css(dir, refValue - $(this).outerHeight());
            });
        }
    };
    
    this.createWrappingGroup = function(){
        var textBlock = null;
        var linkedBlocks = new Array();
        var textBlockDom = null;
        var linkedBlocksDom = new Array();
        
        // Verificar que se hayan seleccionado los elementos necesarios para la operación...
        $('.ui-selected').each(function(){
            var block = ko.dataFor(this);
            if(block.type == "text"){
                if(textBlock == null){
                    textBlock = block;
                    textBlockDom = this;
                } else {
                    alert('No es posible completar la operación, seleccione sólo un bloque de texto');
                    return false;
                }
            } 
            if(block.type != 'text'){
                linkedBlocks.push(block);
                linkedBlocksDom.push(this);
            }
        });
        if(linkedBlocks.length == 0){
            alert('No es posible completar la operación, debes seleccionar al menos una imagen.');
            return false;
        }
        
        //Asociar recursos
        textBlock.wrappingGroup = new Array();
        for(var i=0; i<linkedBlocksDom.length; i++){
            linkedBlocks[i].wrappingGroup = new Array(); 
            linkedBlocks[i].wrappingGroup.push($(textBlockDom).attr('id')); 
            textBlock.wrappingGroup.push($(linkedBlocksDom[i]).attr('id'));
        }
        console.log('linkedBlocks', linkedBlocks);
        console.log('textBlock', textBlock);
        
        wrapText(textBlock, linkedBlocks, textBlockDom, linkedBlocksDom);
    };

    this.unWrap = function(){
        $('.ui-selected, .editor_group').each(function(){
            var block = ko.dataFor($(this)[0]);
            var selected = false;
            if (block.wrappingGroup == undefined){
                return true;
            }
            if (block.type == 'text' && block.wrappingGroup.length){
                self.unWrapText(block, $(this));
            }
        });
    }

    this.unWrapText = function(block, domBlock){
        block = block == undefined?ko.dataFor($('.active-block')[0]):block;
        domBlock = domBlock == undefined?$('.active-block'):domBlock;
        if (block.wrappingGroup == undefined || !block.wrappingGroup.length){
            return;
        }
        if (block.type == 'text'){
            self.unwrapTextElement(block);
            block.wrappingGroup = new Array();
            wrapText(block, null, domBlock, null);
            block.group(false);
            unlock = true;
            if (domBlock.hasClass('ui-selected')){
                unlock = false;
            }
            self.saveBlockInDB(block, domBlock, unlock);
        }else{
            // Unwrap para imagenes ---Ya se volvió a usar---
            text_block = ko.dataFor($('#'+block.wrappingGroup[0])[0]);
            text_blockDom = $('#'+block.wrappingGroup[0]);
            index_of = text_block.wrappingGroup.indexOf(block.resourceID());
            if (index_of != -1){
                text_block.wrappingGroup.splice(index_of, 1);
            }
            block.wrappingGroup =  new Array();
            related_blocks = new Array();
            related_Dom = new Array();
            for (var j=0; j<text_block.wrappingGroup.length; j++){
                rel_block = $('#'+text_block.wrappingGroup[j]);
                related_blocks.push(ko.dataFor(rel_block[0]));
                related_Dom.push(rel_block);
            }
            wrapText(text_block, related_blocks, text_blockDom, related_Dom);
            self.saveBlockInDB(text_block, text_blockDom, true);
            self.saveBlockInDB(block, domBlock);
            for (var i = 0; i<text_block.wrappingGroup.length; i++){
                this.unlockBlock(text_block.wrappingGroup[i]);
            }
        }
    };

    this.unwrapTextElement = function(block){
        for (var i=0; i<block.wrappingGroup.length; i++){
            unlock = true;
            wrap_block = ko.dataFor($('#'+block.wrappingGroup[i])[0]);
            wrap_block.wrappingGroup = new Array();
            if ($('#'+block.wrappingGroup[i]).hasClass('ui-selected')){
                unlock = false;
            }
            self.saveBlockInDB(wrap_block, $('#'+block.wrappingGroup[i]), unlock);
        }
    }
    
    this.multipleSelection = function(){
        
        /*if ($('.ui-selected').length == 1){
            block = ko.dataFor($('.ui-selected')[0]);
            self.activateBlock(block);
            return;
        }*/
        self.multipleBlocksSelected = true;
        self.currentActiveBlock('multiple');
        //moduleContext.notify('ACTIVE_BLOCK', 'multiple');
        editor_model.activeBlock('multiple');
        var text_id = '';
        var text_blocks = 0;
        $('.ui-selected').each(function() {
            var block = ko.dataFor(this);
            self.activateBlock(block);
            if (block.type == 'text'){
                text_blocks ++;
                if (text_blocks >1){
                    editor_model.isOneGroup(false);
                }
            }
            if (block.wrappingGroup != undefined && block.wrappingGroup.length){
                if (block.group()){
                    block.group(false);
                    return true;
                }
                if (block.type != 'text'){
                    if (text_id == ''){
                        text_id = block.wrappingGroup[0];
                    }else if (text_id != block.wrappingGroup[0]){
                        editor_model.isOneGroup(false);
                    }
                    txt_block = ko.dataFor($('#'+block.wrappingGroup[0])[0]);
                    self.lockBlock(txt_block.resourceID());
                    txt_block.group(true);
                    self.lockFromTextWR(txt_block);
                    block.group(false);
                }else{
                    if (text_id != ''){
                        if (text_id != block.resourceID()){
                            editor_model.isOneGroup(false);
                        }
                    }else{
                        text_id = block.resourceID();
                    }

                    self.lockFromTextWR(block);
                    block.group(false);
                }
            }
            
        });
    };

    this.lockFromTextWR = function(block){
        for(var i=0; i<block.wrappingGroup.length; i++){
            self.lockBlock(block.wrappingGroup[i]);
            group_block = ko.dataFor($('#'+block.wrappingGroup[i])[0]);
            group_block.group(true);
        }
    };
    
    this.removeSelected = function(){
        $('.ui-selected').each(function(){
            console.log('call to remove');
            self.removeBlock(this);
        });
        self.clearMultipleSelection();
    };
    
    this.defineTable = function(block, domBlock, table_content){
        var block = typeof block !== 'undefined' ? block : self.currentActiveBlock();
        var domBlock = typeof domBlock !== 'undefined' ? domBlock : $('.active-block');
        if(typeof table_content !== 'undefined') domBlock.find('table').html(table_content);
        applyBindingsToTableBlock(block, domBlock);
    };
    
    this.defineMath = function(text_code, block, domBlock){
        var block = typeof block !== 'undefined' ? block : self.currentActiveBlock();
        var domBlock = typeof domBlock !== 'undefined' ? domBlock : $('.active-block');
        var text_code = typeof text_code !== 'undefined' ? text_code : domBlock.find('.latex-hidden').html();
        
        $('#latex-textarea').val(text_code);
        domBlock.find('.latex').html('$$' + text_code + '$$');
        domBlock.find('.latex-hidden').html(text_code);
        MathJax.Hub.Config({
            SVG: {
                font: "STIX-Web"
            }
        });
        MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
        applyBindingsToMathBlock(block, domBlock);
    };

    this.defineHTML = function(domBlock){
        var domBlock = typeof domBlock !== 'undefined' ? domBlock : $('.active-block');
        block = self.currentActiveBlock();
        applyBindingsToHTMLBlock(block, $(domBlock));
    };

    function textarea_to_tinymce(id){
        if ( typeof( tinyMCE ) == "object" && typeof( tinyMCE.execCommand ) == "function" ) {
            tinyMCE.execCommand('mceRemoveEditor', false, id);
            tinyMCE.execCommand('mceAddEditor', true, id);
        }
    }
    
    this.getSelectedCells = function(table){
        var selectedCells = $(table).find('.selected-cell');
        if(selectedCells.length == 0)
            selectedCells = $(table).find('.active-cell').length > 0 ? $(table).find('.active-cell'):$(table).find('td');
        return selectedCells;
    }
    this.updateCellHelper = function(){
        activeCell = $('.active-cell').first();
        $('#active-cell-helper').attr('style', $(activeCell).attr('style'));
        var offset = $(activeCell).position();
        if(offset){
            $('#active-cell-helper').css({
                'left': offset.left, 
                'top': offset.top, 
                'width': $(activeCell).outerWidth() + 1,
                'height': $(activeCell).outerHeight() + 1,
            });
        }
    }
}       

function loadMediaPlayer(url, type, iframe){
    var media = null;
    var iframe_content = null;
    if(type == 'audio'){
        media = '<div class="thumbnail audio">' + 
                    "<img class='audio-sample-thumbnail' src='{% static 'theme/dark/icons/audio_thumb.png' %}'>" +
                '</div>' +
                '<audio controls>' + 
                    '<source src="'+ url + '" type="audio/mpeg">' +
                    'Your browser does not support the audio element.' +
                '</audio>';
        iframe_content = "<!doctype html><html><head><link rel='stylesheet' type='text/css' href='{% static 'theme/dark/audio_iframe.css' %}'/></head><body></body></html>";        
    } else if(type == 'video'){
        media = '<video width="480" height="270" controls>' + 
                    '<source src="'+ url + '" type="video/mp4">' +
                    'Your browser does not support the video element.' +
                '</video>';
        iframe_content = "<!doctype html><html><head><link rel='stylesheet' type='text/css' href='{% static 'theme/dark/video_iframe.css' %}'/></head><body></body></html>";        
    }
    
    var target = $(iframe).contents()[0];
    target.open();
    target.write(iframe_content);
    target.close();
    $(iframe).contents().find('body').html(media);
    
    if(type == 'audio'){
        $(iframe).css({'height': 220, 'width': 220});
    } else if(type == 'video'){
        $(iframe).css({'height': 270, 'width': 480});   
    }
}

function applyBindingsToMediaBlock(block, domBlock){
    ko.applyBindings(block, $(domBlock).find('.thumbnail')[0]);
    ko.applyBindings(block, $(domBlock).find('.media-trigger')[0]);
    ko.applyBindings(block, $(domBlock).find('.media')[0]);
    ko.applyBindings(block, $(domBlock).find('.image-caption')[0]);
};

function applyBindingsToImageBlock(block, domBlock){
    ko.applyBindings(block, $(domBlock).find('.image')[0]);
    ko.applyBindings(block, $(domBlock).find('.image-caption')[0]);
};

function applyBindingsToTableBlock(block, domBlock){
    ko.applyBindings(block, $(domBlock).find('.ctable')[0]);
    ko.applyBindings(block, $(domBlock).find('.image-caption')[0]);
};

function applyBindingsToMathBlock(block, domBlock){
    ko.applyBindings(block, $(domBlock).find('.cmath')[0]);
    ko.applyBindings(block, $(domBlock).find('.image-caption')[0]);
};

function applyBindingsToHTMLBlock(block, domBlock){
    ko.applyBindings(block, $(domBlock).find('.iframe')[0]);
    ko.applyBindings(block, $(domBlock).find('.content_html')[0]);
    //tinymce.EditorManager.execCommand('mceAddEditor', true, "editor_html");
    //textarea_to_tinymce('.active-block #editor_html');
    $('.regresar').unbind("click");
    $('.regresar').click(function(){
        content = editor_viewer.getValue();
        tinymce.editors[0].setContent(content);
        $('.active-block').find('.iframe').show();
        $('.active-block').find('.regresar').hide();
        $('.active-block').find('.btn_editor_html').hide();
        //editor_viewer.toTextArea();
        $(editor_viewer.getWrapperElement()).hide();
        $('.active-block').find('#code_html').html('');
        $('.active-block').find('#code_html').hide();
    });
};

function applyBindingsToTextLines(editor, domBlock){
    if($(domBlock).find('.sy-tb-container').length > 0){
        ko.applyBindings(editor, $(domBlock).find('.sy-tb-container')[0]);
    }
};

function applyTinyMCE(domBlock){
    var domBlock = typeof domBlock !== 'undefined' ? $(domBlock) : $('.active-block');
    
    editor_model.aspectRatio(self.aspectRatio);
    var elimine = false;
    editor_viewer = undefined;
    if(tinymce.editors.length){
        elimine = true;
        try{
            tinyMCE.execCommand('mceRemoveEditor',false, tinymce.editors[0].id);
        }catch (e){
            console.log('Error al eliminar el tinymce');
        }
    }

    if (domBlock.hasClass('cmodal')){
        var html_class = '.cmodal-content';
        var tiny_width = 700;
        var textarea_class = '.cmodal-content';
    }else{
        var html_class = '.editor_html';
        var tiny_width = 600;
        var textarea_class = '#code_html';
    }

    domBlock.find(html_class).tinymce({
        theme_advanced_fonts : "Arial; Cabin; Courier New; Cursive; Georgia; Helvetica; Impact; Monaco; Palatino; Tahoma; Times New Roman; Verdana",
        fontsize_formats: "10px 13px 16px 18px 24px 32px 48px",
        font_formats: "Arial=arial;Cabin=cabin;Courier New=courier new;Cursive=cursive;Georgia=georgia;Helvetica=helvetica;Impact=impact;Monaco=monaco;Palatino=palatino;Tahoma=tahoma;Times New Roman=times new roman,times;Verdana=verdana;",
        theme: "modern",
        skin: "synekis",
        width: tiny_width,
        height: 300,
        body_id: 'editor_class',
        statusbar: false,
        menubar:false,
        body_class: "timeline_editor",
        //forced_root_block: '',
        extended_valid_elements: "link[href,type=text/css],svg[*],g[*],path[*],defs[*],use[*]",
        valid_children : "+body[style]",
        invalid_elements : "script",
        plugins: [
          "advlist link wordcount table textcolor hr anchor",
        ],
        toolbar1: "editor_visual editor_html | undo redo h1 h2 | fontselect fontsizeselect | bold italic underline | forecolor backcolor | subscript superscript | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent blockquote | hr table | link anchor img video math",
        setup: function(ed) {
            ed.addButton('editor_visual', {
                title: 'Editor Visual',
                text: 'Editor Visual',
                id: 'editor_visual',
                icon: false,
                onclick: function() {
                }
            });
            ed.addButton('editor_html', {
                title: 'Source Code',
                text: 'Editor HTML',
                id: 'editor_html',
                icon: false,
                onclick: function() {
                    content = tinymce.editors[0].getContent();
                    if (domBlock.hasClass('cmodal')){
                        domBlock.find('.regresar-modal').show();
                        domBlock.find('.cmodal-content').html(content);
                        tinyMCE.activeEditor.remove();
                    }else{
                        domBlock.find('.iframe').hide();
                        domBlock.find('.regresar').show();
                        domBlock.find('.btn_editor_html').show();
                        domBlock.find('#code_html').show();
                        domBlock.find('#code_html').html(content);
                    }
                    if (editor_viewer == undefined){
                        editor_viewer = CodeMirror.fromTextArea(domBlock.find(textarea_class)[0], {
                          mode: "text/html",
                          lineNumbers: true,
                          autoCloseBrackets: true,
                          matchBrackets: true,
                          showCursorWhenSelecting: true,
                          theme: "blackboard"
                        });
                    }else{
                        editor_viewer.getDoc().setValue(content);
                        $(editor_viewer.getWrapperElement()).show();
                    }
                    editor_viewer.setSize('100%','90%');
                    domBlock.find('#code_html').hide();
                    //$('.active-block').find('#code_html').show();
                }
            }),
            ed.addButton('img', {
                title: 'Image',
                onclick: function() {
                    editor_model.showMediaSelector(true, 'image');
                },
                classes: 'widget btn i-img',
            });
            ed.addButton('video', {
                title: 'Video',
                onclick: function() {
                    editor_model.showMediaSelector(true, 'video');
                },
                classes: 'widget btn i-video',
            });
            ed.addButton('h1', {
                title: 'H1',
                onclick: function() {
                    ed.execCommand('FormatBlock', false, 'h1');
                },
                classes: 'widget btn i-h1',
            });
            ed.addButton('h2', {
                title: 'H2',
                onclick: function() {
                    ed.execCommand('FormatBlock', false, 'h2');
                },
                classes: 'widget btn i-h2',
            });
            ed.addButton('math', {
                title: 'Math',
                onclick: function() {
                    if( $('#math_html_editor').find('.math-media-tabs').tabs( "option", "active" ) == 1){
                        new_for_change = true;
                    }else{
                        new_for_change = false;
                    }
                    var node = $(tinyMCE.activeEditor.selection.getNode());
                    var modal = $('#math_html_editor').dialog('open');
                    $('#math_html_editor').css('z-index', '93');
                    $('.ui-widget-overlay').last().css('z-index', '91');
                    var img_latex = '';
                    if (node.data('input') == 'textarea'){
                        $('#math_html_editor').find('.math-media-tabs').tabs({active:1});
                        new_for_change = false;
                    }else{
                        $('#math_html_editor').find('.math-media-tabs').tabs({active:0});
                    }
                    if (node.hasClass('latex_img')){
                        img_latex = node.data('latex');
                        $('#txt_latex_html').val(img_latex);
                        $('#latex_code_html').html('$$'+img_latex+'$$');
                        MathJax.Hub.Config({
                            SVG: {
                                font: "STIX-Web"
                            }
                        });
                        MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
                    }
                    $(modal).siblings('.ui-dialog-titlebar').addClass('modal-math');
                    $('.close-math-modal').off().click(function(){
                        $('#math_html_editor').dialog('close');
                    });
                    
                    if(img_latex != ''){
                        $('#math_html_editor').find('#mathquill-modal').html(img_latex);
                    }else{
                        $('#math_html_editor').find('#mathquill-modal').mathquill('revert');
                        $('#math_html_editor').find('#mathquill-modal').html('');
                        $('#math_html_editor').find('.math-media-tabs').tabs({active:0});
                    }
                    $('#math_html_editor').find('#mathquill-modal').mathquill('editor');
                },
                classes: 'widget btn i-math',
            });
            ed.on('init', function() {
                this.getDoc().body.style.fontSize = '13px';
                this.getDoc().body.style.fontFamily = 'Arial';
            });
        }
    });
    $('.mce-tinymce.mce-container.mce-panel').css('border-width',0);
    
    tinymce.baseURL = "{% static 'libs/tinymce/'%}";
    
    //content = $('.active-block').find('#code_html').html();
    if( domBlock.find('.content_html').find('iframe').length ){
        //content = $('.active-block').find('.content_html').find('iframe').contents().find('body').html();
        videos = domBlock.find('.content_html').find('iframe').contents().find('html').find('.no_borrar');
        videos.each(function(){
            url = $(this).data('url');
            w = $(this).width();
            h = $(this).height();
            $(this).replaceWith("<img src='{% static 'theme/dark/images/html_videoImagen.png' %}' width='"+w+"' height='"+h+"' class='no_borrar' data-url="+url+">");
        });

        videos_embed = domBlock.find('.content_html').find('iframe').contents().find('html').find('.no_borrar_embed');
        videos_embed.each(function(){
            url = $(this).data('url');
            thumbnail = $(this).data('thumbnail');
            w = $(this).width();
            h = $(this).height();
            $(this).replaceWith("<img src='{% static 'theme/dark/images/html_videoImagen.png' %}' width='"+w+"' height='"+h+"' class='no_borrar_embed' data-url="+url+" data-thumbnail='"+thumbnail+"''>")
        });
        content = domBlock.find('.content_html').find('iframe').contents().find('html')[0].outerHTML;
    }else{
        content = '';
    }

    tinymce.editors[0].setContent(content);
    if(!elimine){
        applyTinyMCE(domBlock);
    }
}

function resizeCanvas(element){ //block parent
    if ( editor_model.slideshow){
        return;
    }
    var height = $(element).hasClass('editor-canvas') ? 24:625; //min-height of canvas in px (editor-canvas:normal-editor)
    var blocks = $(element).children(); 
    for(var i=0; i<blocks.length; i++){
        var locHeight =  parseInt($(blocks[i]).css('top')) 
                            + $(blocks[i]).height() 
                            + parseInt($(blocks[i]).css("padding-top")) + parseInt($(blocks[i]).css("padding-bottom"))
                            + 5; //Donde 4 son para el borde, esté el bloque activo o no.
        if(locHeight > height){ height = locHeight; } 
    }
    if($(element).hasClass('main-editor')){ 
        height += 300; 
    }
    $(element).css('height',height);

    if($(element).hasClass('editor-canvas')){
        var quiz_height = $('#quiz-editor').outerHeight();
        $(element).parent().css('height',height);
        $('#quiz-editor').siblings('.horizontal-space').css('height',quiz_height);
    } else if($(element).hasClass('main-editor')) {
        $(element).siblings('.horizontal-space').css('height',height+2);
    }
};

function html2img(element){
    var has_thumbnail = editor_model.thumbnail_slide() != '' ? true : false;
    html2canvas(element, {
        onrendered: function(canvas) {
            var img = canvas.toDataURL('img/png');
            $('#img-preview').html('<img src="'+img+'" width="120px;" height="110px">');
            $.ajax({
                url: "{% url 'EditorAPI:set_thumbnail' %}",
                type: "POST",
                data: {'img_data':img, 'data_id':editor_model.edu_content_id, 'update':has_thumbnail},
                success: function(){
                    editor_model.thumbnail_slide(img);
                }
            });
        }
    });
}

function getContent(element){
    var content = '';
    var children = $(element).children();
    for(var i=0; i<children.length; i++){
        if( !$(children[i]).hasClass('ui-resizable-handle') ){
            if (children[i].attributes['xmlns'] != undefined){
                serializer = new XMLSerializer();
                content += serializer.serializeToString(children[i]);
            }else{
                content += children[i].outerHTML;
            }       
        }
    }
    return content;
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


var ajaxLoaderTemplate =    '<div class="ajax-loader"></div>';

var sampleContent = new Array();
sampleContent['text']     = '<div class="editable-div" contenteditable="true" contenteditable=true placeholder="Escribe un texto aquí"></div>';
sampleContent['file']     = '<div class="empty file-container">' +
                                '<div class="file_url hidden"></div>' +
                                '<img class="file-icon" src=""/>' + 
                                '<span class="doc_name" data-bind="text: file_name">This is a document</span>' + 
                            '</div>';
sampleContent['image']    = '<div class="ajax-loader-container empty">'+ajaxLoaderTemplate+'</div>'+
                            '<div class="image top-caption-ref bot-caption-ref" data-bind="cimage: activeBlock()">' + 
                                '<img src="">' + 
                            '</div>' + 
                            '<div class="image-caption box-sizing-border-box" data-bind="ceditor: true, ccaption: activeBlock(), visible: captionVisible()">' +
                                '<div class="editable-div" contenteditable="true" contenteditable=true placeholder="Escribe un texto aquí"></div>' +
                            '</div>';
sampleContent['audio']    = '<div class="ajax-loader-container empty">'+ajaxLoaderTemplate+'</div>'+
                            '<div class="thumbnail top-caption-ref" data-bind="visible: mediaThumbnailVisible()"></div>' +  
                            '<div class="media-trigger" data-bind="visible: !activeBlock() && mediaThumbnailVisible(), mediaTrigger: true, click: function(){ return false; }, clickBubble: false, css:{\'top-caption\': !captionPosition()}"></div>' +
                            '<div class="media bot-caption-ref" data-bind="visible: !mediaThumbnailVisible()"></div>' +
                            '<div class="image-caption box-sizing-border-box" data-bind="ceditor: true, ccaption: activeBlock(), visible: captionVisible()">' +
                                '<div class="editable-div" contenteditable="true" contenteditable=true placeholder="Escribe un texto aquí"></div>' +
                            '</div>';
sampleContent['video']    = '<div class="ajax-loader-container empty">'+ajaxLoaderTemplate+'</div>'+
                            '<div class="thumbnail top-caption-ref" data-bind="visible: mediaThumbnailVisible()"></div>' + 
                            '<div class="media-trigger" data-bind="visible: !activeBlock() && mediaThumbnailVisible(), mediaTrigger: true, click: function(){ return false; }, clickBubble: false, css:{\'top-caption\': !captionPosition()}"></div>' + 
                            '<div class="media bot-caption-ref" data-bind="visible: !mediaThumbnailVisible()"></div>' + 
                            '<div class="image-caption box-sizing-border-box" data-bind="ceditor: true, ccaption: activeBlock(), visible: captionVisible()">' +
                                '<div class="editable-div" contenteditable="true" contenteditable=true placeholder="Escribe un texto aquí"></div>' +
                            '</div>';
sampleContent['button']   = '<div class="bhelper1 disabled-button orange-button" data-bind="visible: currentActiveBlock()">Botón</div>' + 
                            '<a class="button-anchor" href="#">' +
                                '<button class="bhelper2 trigger button orange-button empty" data-bind="visible: !currentActiveBlock()">Botón</button>' +
                            '</a>';
sampleContent['modal']    = '<div class="cmodal dialog empty" title="Ventana Modal">' + 
                                '<div class="basic-modal-container top-section">' + 
                                    '<input class="cmodal-button-text box-sizing-border-box" type="text" placeholder="Texto" data-bind="value: buttonText">' +  
                                '</div>' +
                                '<div class="basic-modal-container">' + 
                                    '<input class="cmodal-title box-sizing-border-box" type="text" placeholder="Título" data-bind="value: cModalTitle">' + 
                                    '<div class="editor-html contains-float-elements">' +
                                        '<div class="btn-ed-1 left regresar-modal" style="display:none;"><span class="label">Editor Visual</span></div>'+
                                    '</div>' +
                                    '<textarea class="cmodal-content box-sizing-border-box" placeholder="Contenido" style="width:700px; height: 243px;"></textarea>' +
                                '</div>' +
                                '<div class="dialog-buttons contains-float-elements">' +
                                    '<div class="button large-button contrast" data-bind="click: function(){ showCurrentActiveModal(false); }">' +
                                        '<span>Cancelar</span>' +
                                    '</div>' +
                                    '<div class="button large-button contrast-2" data-bind="click: function(){ removeEmptyClass(); showCurrentActiveModal(false); }">' +
                                        '<span>Aceptar</span>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            '<div class="bhelper1 disabled-button orange-button" data-bind="visible: currentActiveBlock()">Botón</div>' + 
                            '<button class="bhelper2 trigger button orange-button empty" data-bind="visible: !currentActiveBlock()">Botón</button>';
                            //Si se modifica la estructura de las tablas es necesario ajustar también "createTableFromString"   
sampleContent['table']    = '<table class="ctable top-caption-ref bot-caption-ref" data-bind="ctable: activeBlock() && editable()">' + 
                                '<tr>' +
                                    '<td style="font-family: Cabin; font-size: 13px; color: #000000; background-color: #ffffff; border: 1px solid; border-color: #d9dad9; width: 80px;">Celda</td>' +
                                    '<td style="font-family: Cabin; font-size: 13px; color: #000000; background-color: #ffffff; border: 1px solid; border-color: #d9dad9; width: 80px;">Celda</td>' +
                                    '<td style="font-family: Cabin; font-size: 13px; color: #000000; background-color: #ffffff; border: 1px solid; border-color: #d9dad9; width: 80px;">Celda</td>' +
                                '</tr>' + 
                                '<tr>' + 
                                    '<td style="font-family: Cabin; font-size: 13px; color: #000000; background-color: #ffffff; border: 1px solid; border-color: #d9dad9; width: 80px;">Celda</td>' +
                                    '<td style="font-family: Cabin; font-size: 13px; color: #000000; background-color: #ffffff; border: 1px solid; border-color: #d9dad9; width: 80px;">Celda</td>' + 
                                    '<td style="font-family: Cabin; font-size: 13px; color: #000000; background-color: #ffffff; border: 1px solid; border-color: #d9dad9; width: 80px;">Celda</td>' + 
                                '</tr>' +
                                '<tr>' + 
                                    '<td style="font-family: Cabin; font-size: 13px; color: #000000; background-color: #ffffff; border: 1px solid; border-color: #d9dad9; width: 80px;">Celda</td>' + 
                                    '<td style="font-family: Cabin; font-size: 13px; color: #000000; background-color: #ffffff; border: 1px solid; border-color: #d9dad9; width: 80px;">Celda</td>' + 
                                    '<td style="font-family: Cabin; font-size: 13px; color: #000000; background-color: #ffffff; border: 1px solid; border-color: #d9dad9; width: 80px;">Celda</td>' + 
                                '</tr>' + 
                            '</table>' + 
                            '<div class="image-caption box-sizing-border-box" data-bind="ceditor: true, ccaption: activeBlock(), visible: captionVisible()">' +
                                '<div class="editable-div" contenteditable="true" contenteditable=true placeholder="Escribe un texto aquí"></div>' +
                            '</div>';
sampleContent['circle']   = '<div class="circle"></div>';
sampleContent['triangle'] = '<div class="triangle"></div>';
sampleContent['line']     = '<div class="line"></div>';
sampleContent['slider']   = '<div class="swiper-container empty">' +
                                '<div class="swiper-wrapper">' + 
                                '</div>' + 
                            '</div>' +
                            '<div class="swiper-thumbnails contains-float-elements" data-bind="visible: swiperThumbnailsVisible, click: function(){ return true; }, clickBubble: false">' +
                            '</div>';
sampleContent['gallery']  = '<div class="swiper-container empty">' +
                                '<div class="swiper-wrapper">' + 
                                '</div>' + 
                            '</div>' +
                            '<div class="swiper-thumbnails contains-float-elements" data-bind="visible: swiperThumbnailsVisible, click: function(){ return true; }, clickBubble: false">' +
                            '</div>';
sampleContent['tabs']     = 'TABS'; 
sampleContent['figuras_geo'] =  '';
sampleContent['math']     = '<div class="cmath top-caption-ref bot-caption-ref" data-bind="cmath: (activeBlock() && editable())">' +
                                '<span class="mathquill-editor" data-bind="visible: mathVisible()"></span>'+
                                '<p class="latex" data-bind="visible: !mathVisible()">$$x^2$$</p>'+
                                '<p class="latex-hidden hidden tex2jax_ignore">x^2</p>' +
                            '</div>' + 
                            '<div class="image-caption box-sizing-border-box" data-bind="ceditor: true, ccaption: activeBlock(), visible: captionVisible()">' +
                                '<div class="editable-div" contenteditable="true">' + 
                                    '<font color="#000000" style="background-color: none; font-family: Arial; font-size: 13px;">' +
                                        'Escribe un texto aquí' + 
                                    '</font>' + 
                                '</div>' +
                            '</div>';
sampleContent['quizb']    = '<div class="bhelper1 disabled-button orange-button" data-bind="visible: currentActiveBlock()">Botón</div>' + 
                            '<a class="bhelper2 trigger button orange-button empty" data-bind="visible: !currentActiveBlock(), click: function(){ return true; }, clickBubble: false">Botón</a>';
sampleContent['html_editor'] = '<div class="overlay" style="width:100%; height=100%; display:none; cursor:no-drop;"></div>'+
                               '<div class="editor-html contains-float-elements">' +
                                   '<div class="btn-ed-1 left regresar" style="display:none;"><span class="label">Editor Visual</span></div>'+
                                   '<div class="btn-ed-2 left btn_editor_html" style="display:none;"><span class="label">Editor HTML</span></div>'+
                               '</div>' +     
                               '<div class="iframe" data-bind="visible: htmlVisible()" style="width:100%; height:100%;">'+
                                    '<textarea class="editor_html"></textarea>'+
                               '</div>'+
                               '<textarea id="code_html" style="display:none; width:100%; height:90%; overflow: scroll;"></textarea>'+
                               '<div class="content_html" data-bind="visible: !htmlVisible()" style="width:100%; height:100%;"></div>';
sampleContent['graph'] = '<div class="empty">Gráfica</div>';
sampleContent['slideshow'] = '<div class="bhelper1 disabled-button orange-button" data-bind="visible: currentActiveBlock()">Presentación</div>' + 
                            '<a class="bhelper2 go-slideshow button orange-button empty" data-bind="visible: !currentActiveBlock(), click: function(){ return true; }, clickBubble: false">Presentación</a>';
