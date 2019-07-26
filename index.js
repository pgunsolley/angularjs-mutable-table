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

// TODO: Add ability to remove "REMOVE" buttons on columns, rows and both 
// TODO: Add ability to transclude special directives into specific locations within the template
// TODO: Maybe add a special property to each cell for custom data (like { meta: {} }))

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

  .directive('mtRequiredColumn', [
    function mtRequiredColumnFactory() {
      return {
        restrict: 'A',
        require: 'mtMutableTable',
        link: link
      };

      function link(scope, elem, attrs, mtMutableTable) {
        attrs.$observe('mtRequiredColumn', function(val) {
          if (mtMutableTable.columnHeads.indexOf(val) < 0) {
            mtMutableTable.columnHeads.push(val);
          }
        });
      }
    }
  ])

  .directive('mtRequiredRow', [
    function mtRequiredRowFactory() {
      return {
        restrict: 'A',
        require: 'mtMutableTable',
        link: link
      };

      function link(scope, elem, attrs, mtMutableTable) {
        attrs.$observe('mtRequiredRow', function(val) {
          if (mtMutableTable.rowStubs.indexOf(val) < 0) {
            mtMutableTable.rowStubs.push(val);
          }
        });
      }
    }
  ])

  .directive('mtLockedColumn', [
    function mtLockedColumnFactory() {
      return {
        restrict: 'A',
        require: 'mtMutableTable',
        link: link
      };

      function link(scope, elem, attrs, mtMutableTable) {
        if (!attrs.mtLockedColumn) {
          throw new Error('attribute mt-locked-column must have a value');
        }
        mtMutableTable.lockColumn(attrs.mtLockedColumn);
      }
    }
  ])

  .directive('mtLockedRow', [
    function mtLockedRowFactory() {
      return {
        restrict: 'A',
        require: 'mtMutableTable',
        link: link
      };

      function link(scope, elem, attrs, mtMutableTable) {
        if (!attrs.mtLockedRow) {
          throw new Error('attribute mt-locked-row must have a value');
        }
        mtMutableTable.lockRow(attrs.mtLockedRow);
      }
    }
  ])

  .directive('mtMutableTable', [
    '$parse',
    function mtMutableTableFactory($parse) {
      // A template literal would be preferred, however at the time of writing this, 
      // my company's build pipeline didn't support some modern JS features :3 
      let template = 
          '<table class="{{tableClass}}" id="{{tableId}}">' +
            '<thead>' +
              '<tr>' +
                '<th>{{mt.rowsHeader}}</th>' +
                '<th ng-repeat="columnHead in mt.columnHeads">' +
                  '<form editable-form mt-p2p-form mt-p2p-namespace="columnForms" name="{{appendTo(\'columnForm\', $index)}}" ng-show="getColumnForm(\'columnForm\' + $index).$visible">' +
                    '<button type="submit" class="{{saveBtnClass}}" ng-click="xeditableFormToggle(); mt.hooks.afterSave()" ng-disabled="getColumnForm(\'columnForm\' + $index).$waiting" ng-show="getColumnForm(\'columnForm\' + $index).$visible">Save</button>' +
                    '<button type="button" class="{{cancelBtnClass}}" ng-disabled="getColumnForm(\'columnForm\' + $index).$waiting" ng-show="getColumnForm(\'columnForm\' + $index).$visible" ng-click="getColumnForm(\'columnForm\' + $index).$cancel(); xeditableFormToggle(); mt.hooks.afterCancel()">Cancel</button>' +
                    '<button type="button" class="{{removeBtnClass}}" ng-click="xeditableFormToggle(); getColumnForm(\'columnForm\' + $index).$cancel();  mt.removeColumn($index);" ng-show="getColumnForm(\'columnForm\' + $index).$visible && !disableRemoveColumns() && !disableRemove() && !checkIfColumnLocked(mt.columnHeads[$index])">Remove</button>' +
                  '</form>' +
                  '<button type="button" class="{{editBtnClass}}" ng-hide="disableEdit() || disableEditColumns() || xeditableFormActive || getColumnForm(\'columnForm\' + $index).$visible" ng-click="getColumnForm(\'columnForm\' + $index).$show(); xeditableFormToggle()">Edit</button>' + 
                  '{{mt.generateColumnHeadPrefix(columnHead) + "&nbsp;" + columnHead}}' + 
                '</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              '<tr ng-repeat="rowObj in tableModel">' +
                '<td>' +
                  '<form editable-form mt-p2p-form mt-p2p-namespace="rowForms" name="rowForm" ng-show="rowForm.$visible">' +
                    '<button type="submit" class="{{saveBtnClass}}" ng-disabled="rowForm.$waiting" ng-show="rowForm.$visible" ng-click="xeditableFormToggle(); mt.hooks.afterSave()">Save</button>' +
                    '<button type="button" class="{{cancelBtnClass}}" ng-disabled="rowForm.$waiting" ng-show="rowForm.$visible" ng-click="rowForm.$cancel(); xeditableFormToggle(); mt.hooks.afterCancel()">Cancel</button>' +
                    '<button type="button" class="{{removeBtnClass}}" ng-show="rowForm.$visible && !disableRemoveRows() && !disableRemove() && !checkIfRowLocked(rowObj.rowStub)" ng-click="xeditableFormToggle(); rowForm.$cancel(); mt.removeRow($index);">Remove</button>' + 
                  '</form>' +
                  '<button ng-hide="disableEdit() || disableEditRows()" type="button" class="{{editBtnClass}}" ng-click="xeditableFormToggle(); rowForm.$show()" ng-show="!xeditableFormActive && !rowForm.$visible">Edit</button>' + 
                  '&nbsp;<b>{{mt.generateRowStubPrefix(rowObj.rowStub) + "&nbsp;" + rowObj.rowStub}}</b>' +
                '</td>' +
                '<td ng-repeat="cell in rowObj.cells">' +
                  '<span ng-show="!rowForm.$visible && !getColumnForm(\'columnForm\' + $index).$visible">{{cell.value}}</span>' + 
                  '<span ng-show="rowForm.$visible" editable-text="cell.value" e-form="rowForm" e-name="{{appendTo(\'row\', $index)}}">{{cell.value}}</span>' + 
                  '<button ng-show="rowForm.$visible && $index > 0" type="button" class="{{fillBtnClass}}" ng-click="fillLeft($index, rowForm)">&#8592;</button>' +
                  '<button ng-show="rowForm.$visible && $index < rowObj.cells.length - 1" type="button" class="{{fillBtnClass}}" ng-click="fillRight($index, rowForm)">&#8594;</button>' +
                  '<span ng-show="getColumnForm(\'columnForm\' + $index).$visible" editable-text="cell.value" e-form="getColumnForm(\'columnForm\' + $index)" e-name="{{appendTo(\'column\', $index)}}">{{cell.value}}</span>' +
                  '<button type="button" ng-show="getColumnForm(\'columnForm\' + $index).$visible && tableModel.indexOf(rowObj) > 0" class="{{fillBtnClass}}" ng-click="fillLeft(tableModel.indexOf(rowObj), getColumnForm(\'columnForm\' + $index))">&#8593;</button>' +
                  '<button type="button" ng-show="getColumnForm(\'columnForm\' + $index).$visible && tableModel.indexOf(rowObj) < tableModel.length - 1" class="{{fillBtnClass}}" ng-click="fillRight(tableModel.indexOf(rowObj), getColumnForm(\'columnForm\' + $index))">&#8595;</button>' +
                  '<div id="mt-transclude-cell-item" ng-show="getColumnForm(\'columnForm\' + $index).$visible || rowForm.$visible"></div>' +
                '</td>' +
              '</tr>' +
            '</tbody>' +
          '</table>';
      return {
        restrict: 'E',
        controller: ['$scope', '$attrs', '$timeout', controller],
        scope: true,
        controllerAs: 'mt',
        link: link,
        template: template,
        transclude: true
      }

      function controller($scope, $attrs, $timeout) {
        var self = $attrs.name ? $scope.$parent[$attrs.name] = this : this,
        
        // @Private properties

        /**
         * Hooks can be registered using the 'setHook' method on the controller.
         * I'm not a fan of the scope-cluttered event system in angularjs. Hooks are a 
         * great way to attach functionality to the mutable-table lifecycle whenever
         * the logic is simple and doesn't need evaluation against a scope.
         *
         * Hooks are executed synchronously, and some can return a boolean.
         * If false is returned, the action dependent on the hook return value 
         * will not execute.
         */
        hooks = {};

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
          },
          hooks: {
            get: function() {
              return hooks;
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
        
        /**
         * Locks prevent columns or rows from being removed.
         * Each lock type is an array of strings that correspond to a 
         * columnHead or rowStub.
         *
         * Cells generated for locked columns and rows should 
         * be added to the cells array.
         */
        $scope.locks = { column: [], row: [], cells: [] };
        
        // @Public methods

        self.setHook = setHook;
        self.removeHook = removeHook;
        self.initFromCells = initFromCells;
        self.addColumn = addColumn;
        self.removeColumn = removeColumn;
        self.addRow = addRow;
        self.removeRow = removeRow;
        self.addCells = addCells;
        self.removeCells = removeCells;
        self.render = render;
        self.showColumnEditableForm = showEditableForm('columnForms');
        self.showRowEditableForm = showEditableForm('rowForms');
        self.generateColumnHeadPrefix = generateColumnHeadPrefix;
        self.generateRowStubPrefix = generateRowStubPrefix;
        self.lockColumn = lockColumn;
        self.lockRow = lockRow;
        self.unlockColumn = unlockFactory('column');
        self.unlockRow = unlockFactory('row');
        self.isLockedColumn = isLockedFactory('column');
        self.isLockedRow = isLockedFactory('row');

        initHooks();

        function initHooks() {
          hooks = {};
          [
            'afterSave',
            'beforeRemove',
            'afterRemove',
            'afterCancel'
          ].forEach(function(hookName) {
            hooks[hookName] = function() {};
          });
        }

        /**
         * Allow caller to set hook function by name.
         * this is bound to the mutable-table controller.
         * @param {*} name 
         * @param {*} func 
         */
        function setHook(name, func) {
          if (typeof func !== 'function') {
            throw new Error('Hook must be typeof "function"');
          }
          if (!hooks[name]) {
            throw new Error('Unknown hook ' + name);
          }
          hooks[name] = function() { 
            return func.apply(self, Array.prototype.slice.call(arguments));
          };
        }

        /**
         * Resets a named hook, if it exists.
         * @param {*} name 
         */
        function removeHook(name) {
          if (hooks[name]) {
            hooks[name] = function() {};
          }
        }

        /**
         * Locks column by columnHead name.
         * A locked column cannot be removed.
         * @param {*} columnHead 
         */
        function lockColumn(columnHead) {
          if ($scope.locks.column.indexOf(columnHead) < 0) {
            $scope.locks.column.push(columnHead);
          }
        }

        /**
         * Locks a row by rowStub name.
         * A locked row cannot be removed.
         * @param {*} rowStub 
         */
        function lockRow(rowStub) {
          if ($scope.locks.row.indexOf(rowStub) < 0) {
            $scope.locks.row.push(rowStub);
          }
        }

        function unlockFactory(type) {
          return function unlock(name) {
            var idx = $scope.locks[type].indexOf(name);
            if (idx > -1) {
              $scope.locks.column.splice(idx, 1);
              $scope.locks.cells = $scope.locks.cells.filter(function(cell) {
                return cell[type === 'column' ? 'columnHead' : 'rowStub'] !== name;
              });
            }
          }
        }

        /**
         * Generates a function that will check the corresponding
         * lock type for a given column head or row stub.
         * @param {*} type 
         */
        function isLockedFactory(type) {
          return function isLocked(name) {
            return $scope.locks[type].indexOf(name) > -1;
          }
        }

        /**
         * Add a column head string to the columnHeads array, 
         * triggering watch expressions to add the corresponding cells.
         */
        function addColumn(columnHead) {
          if (self.columnHeads.indexOf(columnHead) > -1)
            console.warn('Column head of ' + columnHead + ' already exists.');
          else if (self.busy) {
            console.warn('Table is busy; unable to add column.');
          }
          else 
            self.columnHeads.push(columnHead);
        }
        
        /**
         * Same as addColumn, but removes a columnHead string, 
         * and removes cells.
         */
        function removeColumn(index) {
          var removeHookRes, targetColumnHead = self.columnHeads[index];
          if (self.busy)
            console.warn('Table is busy; unable to remove column.');
          else {
            removeHookRes = hooks.beforeRemove(targetColumnHead, self.columnHeads, index);
            if (removeHookRes !== false) {
              self.columnHeads.splice(index, 1);
              hooks.afterRemove(targetColumnHead, self.columnHeads, index);
            }
            else {
              console.log('Not removing column');
            }
          }
        }
        
        /**
         * Add a row string to the rowStubs array,
         * trigger watch expressions to add new cells.
         */
        function addRow(rowStub) {
          if (self.rowStubs.indexOf(rowStub) > -1)
            console.warn('Row stub of ' + rowStub + ' already exists.');
          else if (self.busy) 
            console.warn('Table is busy; unable to add row.');
          else 
            self.rowStubs.push(rowStub);
        }
        
        /**
         * Remove a row stub string from the rowStubs array, 
         * triggering watch expressions to remove all cells within 
         * the corresponding row.
         */
        function removeRow(index) {
          var removeHookRes, targetRowStub = self.rowStubs[index];
          if (self.busy)
            console.warn('Table is busy; unable to remove row.');
          else {
            removeHookRes = hooks.beforeRemove(targetRowStub, self.rowStubs, index);
            if (removeHookRes !== false) {
              self.rowStubs.splice(index, 1);
              hooks.afterRemove(targetRowStub, self.rowStubs, index);
            } 
            else {
              console.log('Not removing column');
            }
          }
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
                  value: ''
                });
                // If cell belongs to a locked column or row, store 
                // it in locks.cells
                if (
                  self.isLockedColumn(columnHeads[c]) 
                  && self.isLockedRow(rowStubs[r])
                ) {
                  $scope.locks.cells.push(cells[cells.length - 1]);
                }
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

              // Prevents removal of cells that correspond to 
              // locked columns or rows
              && !self.isLockedColumn(cells[cc].columnHead)
              && !self.isLockedRow(cells[cc].rowStub)
            ) {
              removed.push(cells.splice(cc, 1)[0]);
              return removeCells(cc, removed);
            }
          }
          return removed;
        }
        
        /**
         * Generates the TableModel.
         * This object is used by the template to render the table.
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
          self.cells = cells.concat($scope.locks.cells);
          self.cells.forEach(function(cell) {
            if (!cell.columnHead || !cell.rowStub) {
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

        // Higher order function. targetNS (forgot what Ns meant huehue)
        // is a string representation of the namespace for the form type...
        // If this doesn't make sense, check out the mtP2p directives and the 
        // columnForms and rowForms properties on the $scope. They are arrays 
        // assigned to properties on the $scope that act as a namespace for
        // corresponding xeditable forms.
        function showEditableForm(targetNs) {
          return function(i) {
            $timeout(function() {
              // Close all other editable forms first.
              [$scope.rowForms, $scope.columnForms].forEach(function(forms) {
                forms.forEach(function(form) {
                  form.$cancel();
                });
              });
              // Show target table
              $scope[targetNs][i].$show();
              $scope.xeditableFormActive = true;
            });
          }
        }

        function generateColumnHeadPrefix(columnHead) {
          if (self.columnHeadPrefixGenerator) {
            return self.columnHeadPrefixGenerator(columnHead, self.columnHeads);
          }
          return "";
        }

        function generateRowStubPrefix(rowStub) {
          if (self.rowStubPrefixGenerator) {
            return self.rowStubPrefixGenerator(rowStub, self.rowStubs);
          }
          return "";
        }
      }
      
      // Getting pretty big :/
      // Considering a rewrite that uses an isolate scope instead of manually working with attrs.
      function link(scope, elem, attrs, ctrl, transclude) {
        // An object/namespace for transcluded scopes.
        var transcludedScope = {};

        scope.xeditableFormActive = false;
        scope.xeditableFormToggle = xeditableFormToggle.bind(scope);
        scope.startWatching = startWatching.bind(scope);
        scope.stopWatching = stopWatching.bind(scope);
        scope.fillLeft = fillLeft.bind(scope);
        scope.fillRight = fillRight.bind(scope);
        scope.appendTo = appendTo.bind(scope);
        scope.getColumnForm = getColumnForm.bind(scope);
        scope.closeAllForms = closeAllForms.bind(scope);
        scope.getScope = getScope.bind(scope);
        scope.checkIfColumnLocked = checkIfLockedFactory('column').bind(scope);
        scope.checkIfRowLocked = checkIfLockedFactory('row').bind(scope);

        // Bind attributes to scope
        scope.tableClass = attrs.mtTableClass || "";
        scope.tableId = attrs.mtTableId || "";
        scope.editBtnClass = attrs.mtBtnClass || attrs.mtEditBtnClass || "";
        scope.saveBtnClass = attrs.mtBtnClass || attrs.mtSaveBtnClass || "";
        scope.cancelBtnClass = attrs.mtBtnClass || attrs.mtCancelBtnClass || "";
        scope.removeBtnClass = attrs.mtBtnClass || attrs.mtRemoveBtnClass || "";
        scope.fillBtnClass = attrs.mtBtnClass || attrs.mtFillBtnClass || "";
        scope.disableEdit = editOrRemoveActionExpressionFactory(attrs.mtDisableEditColumns);
        scope.disableEditColumns = editOrRemoveActionExpressionFactory(attrs.mtDisableEditColumns, {
          $columnHeads: ctrl.columnHeads
        });
        scope.disableEditRows = editOrRemoveActionExpressionFactory(attrs.mtDisableEditRows, {
          $rowStubs: ctrl.rowStubs
        });

        // TODO: Maybe swap words "disableRemove" with "lock" to be more consistent with new lock feature.
        scope.disableRemoveColumns = editOrRemoveActionExpressionFactory(attrs.mtDisableRemoveColumns, {
          $columnHeads: ctrl.columnHeads
        });
        scope.disableRemoveRows = editOrRemoveActionExpressionFactory(attrs.mtDisableRemoveRows, {
          $rowStubs: ctrl.rowStubs
        });
        scope.disableRemove = editOrRemoveActionExpressionFactory(attrs.mtDisableRemove);
        scope.columnHeadPrefixTransform = attrs.mtColumnHeadPrefixTransform;
        scope.rowStubPrefixTransform = attrs.mtRowStubPrefixTransform;

        scope.startWatching();

        // TODO: Break off the templates by directive?
        transclude(function(clone, scope) {
          // TODO: Check for directives
          
        });

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
          
          self.xeditableFormActive = false;
          self.closeAllForms();

          // Values are the same. Either the model was sorted, 
          // or the table was just initialized.
          if (newVal === oldVal) {
            return;
          }
          // If strings are added to the columnHead or rowStub array..
          if (newLength > oldLength) {
            ctrl.addCells();
          }
          // .. removed
          else if (newLength < oldLength) {
            ctrl.removeCells();
          }
          ctrl.render();
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

        // Method with obvious method name does obvious things.
        function closeAllForms() {
          if (this.columnForms) {
            this.columnForms.concat(this.rowForms || []).forEach(function(form) {
              form.$cancel();
            });
          }
        }

        function getScope() {
          return scope;
        }

      /**
        * Parse an optional expression. If a string is passed, 
        * evaluate it with $parse, otherwise just return false;
        * @param {*} optionalExp 
        */
        function editOrRemoveActionExpressionFactory(optionalExp, locals) {
          return function() {
            if (optionalExp) {
              return $parse(optionalExp)(scope.$parent, locals);
            }
            return false;
          }
        }

        function checkIfLockedFactory(type) {
          return function checkIfLocked(name) {
            return this.locks[type].indexOf(name) > -1;
          }
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