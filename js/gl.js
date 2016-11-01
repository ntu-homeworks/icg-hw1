var gl = {
    initGL: function(canvas) {
        try {
            this._gl = canvas.getContext("experimental-webgl");
            this._gl.viewportWidth = canvas.width;
            this._gl.viewportHeight = canvas.height;
        } catch (e) {
        }
        if (!this._gl) {
            alert("Could not initialise WebGL, sorry :-(");
        }   
        if(!this._gl.getExtension('OES_standard_derivatives')) {
   		    throw 'extension not support';
        }

        this._gl.clearColor(0.0, 0.2, 0.2, 1.0);
        this._gl.enable(this._gl.DEPTH_TEST);
    },

    initShaders: function(shaders, attributes) {
        this.shaderProgram = this._gl.createProgram();
        for (var shader in shaders) {
            this._gl.attachShader(this.shaderProgram, this._readShader(shaders[shader]));
        }
        this._gl.linkProgram(this.shaderProgram);

        if (!this._gl.getProgramParameter(this.shaderProgram, this._gl.LINK_STATUS)) {
            alert("Could not initialise shaders");
        }

        this._gl.useProgram(this.shaderProgram);

        this.uniformValues = {};
        if ('uniforms' in attributes) {
            for (var u in attributes.uniforms) {
                this.shaderProgram[u] = this._gl.getUniformLocation(this.shaderProgram, attributes.uniforms[u]);
            }
        }
        if ('vertexAttrs' in attributes) {
            for (var v in attributes.vertexAttrs) {
                this.shaderProgram[v] = this._gl.getAttribLocation(this.shaderProgram, attributes.vertexAttrs[v]);
                this._gl.enableVertexAttribArray(this.shaderProgram[v]);
            }
        }
    },

    textures: {},
    addTexture: function(name, img) {
        this.textures[name] = this._gl.createTexture();
        this.textures[name].image = img;

        this._gl.pixelStorei(this._gl.UNPACK_FLIP_Y_WEBGL, true);
        this._gl.bindTexture(this._gl.TEXTURE_2D, this.textures[name]);
        this._gl.texImage2D(this._gl.TEXTURE_2D, 0, this._gl.RGBA, this._gl.RGBA, this._gl.UNSIGNED_BYTE, img);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR_MIPMAP_NEAREST);
        this._gl.generateMipmap(this._gl.TEXTURE_2D);

        this._gl.bindTexture(this._gl.TEXTURE_2D, null);
    },

    objects: [],
    addObject: function(obj) {
        var genBuffer = function (_this, target, data, itemSize) {
            var buffer = _this._gl.createBuffer();
            _this._gl.bindBuffer(_this._gl[target], buffer);
            _this._gl.bufferData(_this._gl[target], data, _this._gl.STATIC_DRAW);
            buffer.itemSize = itemSize;
            buffer.numItems = data.length / itemSize;
            return buffer;
        }

        this.objects.push({
            buffers: {
                vertexNormalBuffer: genBuffer(this, "ARRAY_BUFFER", new Float32Array(obj.data.vertexNormals), 3),
                vertexTextureCoordBuffer: genBuffer(this, "ARRAY_BUFFER", new Float32Array(obj.data.vertexTextureCoords), 2),
                vertexPositionBuffer: genBuffer(this, "ARRAY_BUFFER", new Float32Array(obj.data.vertexPositions), 3),
                vertexIndexBuffer: genBuffer(this, "ELEMENT_ARRAY_BUFFER", new Uint16Array(obj.data.indices), 1)
            },
            transform: obj.transform,
            attributes: obj.attributes,
            others: obj.others
        });
    },

    drawScene: function() {
        this._gl.viewport(0, 0, this._gl.viewportWidth, this._gl.viewportHeight);
        this._gl.clear(this._gl.COLOR_BUFFER_BIT | this._gl.DEPTH_BUFFER_BIT);

        if (this.objects.length == 0) {
            return;
        }

        var pMatrix = mat4.create();
        var mvMatrixStack = [];

        mat4.perspective(45, this._gl.viewportWidth / this._gl.viewportHeight, 0.1, 100.0, pMatrix);

        for (var obj in this.objects) {
            for (var attr in this.objects[obj].attributes) {
                var value = this.objects[obj].attributes[attr];

                if (value.length == undefined) {
                    this._gl.uniform1f(this.shaderProgram[attr], value);
                } else {
                    this._gl['uniform' + value.length + 'fv'](this.shaderProgram[attr], value);
                }
            }
            this._gl.uniform1i(this.shaderProgram.samplerUniform, 0);
            if ('shaderUniform' in this.shaderProgram && 'shader' in this.objects[obj].others) {
                this._gl.uniform1i(this.shaderProgram.shaderUniform, this.objects[obj].others.shader);
            }

            var mvMatrix = mat4.create();
            mat4.identity(mvMatrix);
			if ('transform' in this.objects[obj]) {
				var transform = this.objects[obj].transform;
				if ('translate' in transform) {
					mat4.translate(mvMatrix, transform.translate);
				}
				if ('rotate' in transform) {
					mat4.rotate(mvMatrix, this._degToRad(transform.rotate.angle), transform.rotate.around);
				}
				if ('scale' in transform) {
					mat4.scale(mvMatrix, transform.scale);
				}
				if ('shear' in transform) {
					mat4.multiply(mvMatrix, mat4.create([1, 0, 0, 0, 1 / Math.tan(this._degToRad(transform.shear)), 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
				}
			}
            this._gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform, false, pMatrix);
            this._gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform, false, mvMatrix);

            if ('nMatrixUniform' in this.shaderProgram) {
                var normalMatrix = mat3.create();
                mat4.toInverseMat3(mvMatrix, normalMatrix);
                mat3.transpose(normalMatrix);
                this._gl.uniformMatrix3fv(this.shaderProgram.nMatrixUniform, false, normalMatrix);
            }

            this._gl.activeTexture(this._gl.TEXTURE0);
            this._gl.bindTexture(this._gl.TEXTURE_2D, this.textures[this.objects[obj].others.texture]);

            var buffers = this.objects[obj].buffers;
            var bindBufferAttribute = function(_this, buffer, attribute) {
                if (attribute in _this.shaderProgram) {
                    _this._gl.bindBuffer(_this._gl.ARRAY_BUFFER, buffer);
                    _this._gl.vertexAttribPointer(_this.shaderProgram[attribute], buffer.itemSize, _this._gl.FLOAT, false, 0, 0);
                }
            }
            bindBufferAttribute(this, buffers.vertexTextureCoordBuffer, 'textureCoordAttribute');
            bindBufferAttribute(this, buffers.vertexPositionBuffer, 'vertexPositionAttribute');
            bindBufferAttribute(this, buffers.vertexNormalBuffer, 'vertexNormalAttribute');

            this._gl.bindBuffer(this._gl.ELEMENT_ARRAY_BUFFER, buffers.vertexIndexBuffer);
            this._gl.drawElements(this._gl.TRIANGLES, buffers.vertexIndexBuffer.numItems, this._gl.UNSIGNED_SHORT, 0);
        }
    },

    _shaderTypes: {
        "x-shader/x-fragment": "FRAGMENT_SHADER",
        "x-shader/x-vertex": "VERTEX_SHADER"
    },
    _readShader: function(element) {
        var str = "";
        var k = element.firstChild;
        while (k) {
            if (k.nodeType == 3) {
                str += k.textContent;
            }
            k = k.nextSibling;
        }

        var shader;
        if (element.type in this._shaderTypes) {
            shader = this._gl.createShader(this._gl[this._shaderTypes[element.type]]);
        } else {
            return null;
        }

        this._gl.shaderSource(shader, str);
        this._gl.compileShader(shader);

        if (!this._gl.getShaderParameter(shader, this._gl.COMPILE_STATUS)) {
            alert(this._gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    },

    _degToRad: function(degrees) {
        return degrees * Math.PI / 180;
    }
}
