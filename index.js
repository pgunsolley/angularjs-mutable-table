/*
Copyright (c) 2019 Patrick Van Gunsolley <patrick.gunsolley@outlook.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

'use strict';

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['angular'], factory);
  }
  else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('angular'));
  }
  else {
    root.returnExports = factory(root.angular);
  }
})(typeof self !== 'undefined' ? self : this, function(angular) {
  angular
  
  .module('mutable-table', ['xeditable'])

  .value('mtP2pLinkFactory', function() {
    return function(scope, elem, attr, [form]) {
      let parent, mtP2pNamespace;
      if (!attr.mtP2pNamespace || attr.mtP2pNamespace === "") {
        throw new Error('mt-p2p-namespace attribute is required');
      }
      parent = scope.$parent;
      mtP2pNamespace = attr.mtP2pNamespace;
      parent[mtP2pNamespace] = parent[mtP2pNamespace] || [];
      parent[mtP2pNamespace].push(form);
      scope.$on('$destroy', function() {
        parent[mtP2pNamespace].splice(parent[mtP2pNamespace].indexOf(form), 1);
      });
    }
  })

  .directive('mtP2pForm', [
    'mtP2pLinkFactory',
    function mtP2pFormFactory(mtP2pLinkFactory) {
      return {
        restrict: 'A',
        require: ['form'],
        link: mtP2pLinkFactory()
      };
    }
  ])

  .directive('mtMutableTable', [
    function mtMutableTableFactory() {
      // A template literal would be preferred, however at the time of writing this, 
      // my company's build pipeline didn't support some modern JS features :3 
      let template = 
          '<table class="{{tableClass}}" id="{{tableId}}">' +
            '<thead>' +
              '<tr>' +
                '<th>{{mt.rowsHeader}}</th>' +
                  '<th ng-repeat="columnHead in mt.columnHeads">' +
                    '<form editable-form mt-p2p-form mt-p2p-namespace="columnForms" name="{{appendTo(\'columnForm\', $index)}}" ng-show="getColumnForm(\'columnForm\' + $index).$visible">' +
                      '<button type="submit" ng-click="xeditableFormToggle()" ng-disabled="getColumnForm(\'columnForm\' + $index).$waiting" ng-show="getColumnForm(\'columnForm\' + $index).$visible">Save</button>' +
                      '<button type="button" ng-disabled="getColumnForm(\'columnForm\' + $index).$waiting" ng-show="getColumnForm(\'columnForm\' + $index).$visible" ng-click="getColumnForm(\'columnForm\' + $index).$cancel(); xeditableFormToggle()">Cancel</button>' +
                      '<button type="button" ng-click="xeditableFormToggle(); getColumnForm(\'columnForm\' + $index).$cancel();  mt.removeColumn($index);" ng-show="getColumnForm(\'columnForm\' + $index).$visible">Remove</button>' +
                    '</form>' +
                    '<button ng-disabled="xeditableFormActive" ng-hide="getColumnForm(\'columnForm\' + $index).$visible" ng-click="getColumnForm(\'columnForm\' + $index).$show(); xeditableFormToggle()">Edit</button>{{columnHead}}' + 
                  '</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
                '<tr ng-repeat="rowObj in tableModel">' +
                  '<td>' +
                    '<form editable-form mt-p2p-form mt-p2p-namespace="rowForms" name="rowForm" ng-show="rowForm.$visible">' +
                      '<button ng-click="xeditableFormToggle()" type="submit" ng-disabled="rowForm.$waiting" ng-show="rowForm.$visible">Save</button>' +
                      '<button type="button" ng-disabled="rowForm.$waiting" ng-show="rowForm.$visible" ng-click="rowForm.$cancel(); xeditableFormToggle()">Cancel</button>' +
                      '<button type="button" ng-click="xeditableFormToggle(); rowForm.$cancel();  mt.removeRow($index);" ng-show="rowForm.$visible">Remove</button>' + 
                    '</form>' +
                    '<button ng-disabled="xeditableFormActive" ng-click="xeditableFormToggle(); rowForm.$show()" ng-show="!rowForm.$visible">Edit</button>{{rowObj.rowStub}}' +
                  '</td>' +
                  '<td ng-repeat="cell in rowObj.cells">' +
                    '<div id="editable-cells">' +
                      '<span>{{cell.value}}</span>' +  
                      '<div ng-show="rowForm.$visible" editable-text="cell.value" e-form="rowForm" e-name="{{appendTo(\'row\', $index)}}">' + 
                        '<span ng-if="rowForm.$visible">' +
                          '<button ng-if="$index > 0" ng-click="fillLeft($index, rowForm)">Fill Left</button>' +
                          '<button ng-if="$index < rowObj.cells.length - 1" ng-click="fillRight($index, rowForm)">Fill Right</button>' +
                        '</span>' +
                      '</div>' +
                      '<div ng-if="getColumnForm(\'columnForm\' + $index).$visible" editable-text="cell.value" e-form="getColumnForm(\'columnForm\' + $index)" e-name="{{appendTo(\'column\', $index)}}">' +
                        '<span ng-show="getColumnForm(\'columnForm\' + $index).$visible">' + 
                          '<button ng-if="tableModel.indexOf(rowObj) > 0" ng-click="fillLeft(tableModel.indexOf(rowObj), getColumnForm(\'columnForm\' + $index))">Fill Up</button>' +
                          '<button ng-if="tableModel.indexOf(rowObj) < tableModel.length - 1" ng-click="fillRight(tableModel.indexOf(rowObj), getColumnForm(\'columnForm\' + $index))">Fill Down</button>' +
                        '</span>' +
                      '</div>' +
                    '</div>' +
                  '</td>' +
                '</tr>' +
            '</tbody>' +
          '</table>';
      return {
        restrict: 'E',
        controller: ['$scope', '$attrs', controller],
        scope: true,
        controllerAs: 'mt',
        link: link,
        template: template
      }
      
      function controller($scope, $attrs) {
        var self = $attrs.name ? $scope.$parent[$attrs.name] = this : this;

        // @Public properties

        /**
         * Getters
         */
        Object.defineProperties(self, {
         /* 
          * Adds a busy prop to the controller that evaluates to true 
          * when the table's state should be locked, preventing modification 
          * to the columnHeads and rowStubs.
          */
          busy: {
            get: function() {
              return $scope.xeditableFormActive;
            }
          }
        });

        /**
         * An array of strings that define the column heads.
         */
        self.columnHeads = [];

        /**
         * An array of strings that define the row stubs.
         */
        self.rowStubs = [];
        
        /**
         * An array of cell objects.
         * Cells are the primary building blocks for the table model.
         *
         * {
         *    columnHead: number,
         *    rowStub: number,
         *    value: string
         * }
         */
        self.cells = [];
        
        // @Protected properties (not published on parent scope)
        
        /**
         * The model used by the template for rendering the table.
         * It uses references to the cells in the cells array.
         */
        $scope.tableModel = [];
        
        // @Public methods

        self.initFromCells = initFromCells;
        self.addColumn = addColumn;
        self.removeColumn = removeColumn;
        self.addRow = addRow;
        self.removeRow = removeRow;
        self.addCells = addCells;
        self.removeCells = removeCells;
        self.render = render;
                
        /**
         * Add a column head string to the columnHeads array, 
         * triggering watch expressions to add the corresponding cells.
         */
        function addColumn(columnHead) {
          if (self.columnHeads.indexOf(columnHead) === -1 && !self.busy)
            self.columnHeads.push(columnHead);
        }
        
        /**
         * Same as addColumn, but removes a columnHead string, 
         * and removes cells.
         */
        function removeColumn(index) {
          if (!self.busy)
            self.columnHeads.splice(index, 1);
        }
        
        /**
         * Add a row string to the rowStubs array,
         * trigger watch expressions to add new cells.
         */
        function addRow(rowStub) {
          if (self.rowStubs.indexOf(rowStub) === -1 && !self.busy)
            self.rowStubs.push(rowStub);
        }
        
        /**
         * Remove a row stub string from the rowStubs array, 
         * triggering watch expressions to remove all cells within 
         * the corresponding row.
         */
        function removeRow(index) {
          if (!self.busy)
            self.rowStubs.splice(index, 1);
        }
  
        /**
         * Poorly named; sorry.
         * Generates new cells for new column heads 
         * and row stubs.
         */
        function addCells() {
          let rowStubs = self.rowStubs,
              columnHeads = self.columnHeads,
              cells = self.cells,
              cellExists;
          for (let r = 0; r < rowStubs.length; ++r) {
            for (let c = 0; c < columnHeads.length; ++c) {
              cellExists = false;
              for (let cc = 0; cc < cells.length; ++cc) {
                // Check if cell exists
                if (
                  cells[cc].rowStub === rowStubs[r]
                  && cells[cc].columnHead === columnHeads[c]
                ) {
                  cellExists = true;
                  break;
                }
              }
              if (!cellExists) {
                cells.push({
                  columnHead: columnHeads[c],
                  rowStub: rowStubs[r],
                  value: '-'
                });
              }
            }
          } 
        }
        
        /**
         * A recursive function that remove cells by startIndex.
         * An array of removed cells may be optionally passed
         * as the second argument in order to maintain state 
         * throughout recursion.
         * Returns an array of removed cells.
         */
        function removeCells(startIndex, removed) {
          let cells = self.cells,
              columnHeads = self.columnHeads,
              rowStubs = self.rowStubs;
          removed = removed || [];
          for (let cc = startIndex || 0; cc < cells.length; ++cc) {
            if (
              columnHeads.indexOf(cells[cc].columnHead) === -1
              || rowStubs.indexOf(cells[cc].rowStub) === -1
            ) {
              removed.push(cells.splice(cc, 1)[0]);
              return removeCells(cc, removed);
            }
          }
          return removed;
        }
        
        /**
         * Renders the cells into the view. 
         * The tableModel is generated using the cells.
         */
        function render() {
          let cells = self.cells,
              columnHeads = self.columnHeads,
              rowStubs = self.rowStubs,
              tableModel = $scope.tableModel = [];
          
          for (let r = 0; r < rowStubs.length; ++r) {
            // Build row object
            tableModel[r] = {
              rowStub: rowStubs[r],
              cells: []
            };
            // Create column by pushing cells
            for (let c = 0; c < columnHeads.length; ++c) {
              for (let cc = 0; cc < cells.length; ++cc) {
                if (
                  cells[cc].rowStub === rowStubs[r]
                  && cells[cc].columnHead === columnHeads[c]
                ) {
                  tableModel[r].cells.push(cells[cc]);
                }
              }
            }
          }
        }
        
        /**
         * Initialize the table with a passed array of cells.
         */
        function initFromCells(cells) {
          $scope.stopWatching();
          self.columnHeads = [];
          self.rowStubs = [];
          self.cells = cells;
          self.cells.forEach(function(cell) {
            if (!cell.columnHead || !cell.rowStub || !cell.value) {
              throw new Error('Unable to initialize table; invalid cell structure detected.');
            }
            if (self.columnHeads.indexOf(cell.columnHead) === -1) {
              self.columnHeads.push(cell.columnHead);
            }
            if (self.rowStubs.indexOf(cell.rowStub) === -1) {
              self.rowStubs.push(cell.rowStub);
            }
          });
          self.render();
          $scope.startWatching();
        }
      }
      
      /**
       * The Zelda function
       */
      function link(scope, _, attrs) {
        scope.xeditableFormActive = false;
        scope.xeditableFormToggle = xeditableFormToggle.bind(scope);
        scope.startWatching = startWatching.bind(scope);
        scope.stopWatching = stopWatching.bind(scope);
        scope.fillLeft = fillLeft.bind(scope);
        scope.fillRight = fillRight.bind(scope);
        scope.appendTo = appendTo.bind(scope);
        scope.getColumnForm = getColumnForm.bind(scope);

        // Attach class, id, etc from attributes
        scope.tableClass = attrs.class || "";
        scope.tableId = attrs.id || "";

        scope.startWatching();
  
        function startWatching() {
          this.dereg = [
            this.$watch('mt.columnHeads', rowStubOrColumnHeadChange.bind(scope), true),
            this.$watch('mt.rowStubs', rowStubOrColumnHeadChange.bind(scope), true)
          ];
        }
        
        function stopWatching() {
          this.dereg.forEach(function(dereg) {
            dereg();
          });
        }
        
        // Main handler for row or column changes.
        function rowStubOrColumnHeadChange(newVal, oldVal) {
          let self = this,
              newLength = newVal.length,
              oldLength = oldVal.length;
          
          // Values are the same. Either the model was sorted, 
          // or the table was just initialized.
          if (newVal === oldVal) {
            return;
          }
          // If strings are added to the columnHead or rowStub array..
          if (newLength > oldLength) {
            self.mt.addCells();
          }
          // .. removed
          else if (newLength < oldLength) {
            self.mt.removeCells();
          }
          self.mt.render();
        }
        
        // Set values on all xeditable elements to the right of the current 
        // cell index
        function fillRight(cellIndex, form) {
          let editables = form.$editables,
              value = editables[cellIndex].scope.$data;
          for (let i = cellIndex + 1; i < editables.length; ++i) {
            editables[i].scope.$data = value;
          }
        }
  
        // Obvious function name is obvious
        function fillLeft(cellIndex, form) {
          let editables = form.$editables,
              value = editables[cellIndex].scope.$data;
          for (let i = cellIndex - 1; i > -1; --i) {
            editables[i].scope.$data = value;
          }
        }
        
        // Lol... why did I do this
        function appendTo(a, b) {
          return a + b;
        }
        
        function getColumnForm(formName) {
          for (let i = 0; i < this.columnForms.length; ++i) {
            if (this.columnForms[i].$name === formName) {
              return this.columnForms[i];
            }
          }
          //throw new Error('Unable to find column form: ' + formName);
        }
      }
      
      // When an xeditable form becomes active, we need to disable all 
      // capabilities for the user to active another form.
      function xeditableFormToggle() {
        this.xeditableFormActive = !this.xeditableFormActive;
      }
    }
  ]);
});