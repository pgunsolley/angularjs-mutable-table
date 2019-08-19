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
  'use strict';

  // Base error object
  var MutableTableError = (function() {
    function MutableTableError(msg, fn, ln) {
      this.message = msg;
      this.fileName = fn;
      this.lineNumber = ln;
    }
    MutableTableError.prototype = Object.create(Error.prototype);
    MutableTableError.prototype.constructor = MutableTableError;
    return MutableTableError;
  })();

  angular
  .module('mutable-table', ['xeditable'])

/**
  * Validators for rows, columns and cells.
  * Mutable-table has error handling abilities similar to ngModel,
  * except it is typeable, using arrays of objects intead of a hash of 
  * arbitrariliy named properties commonly used by angularjs.
  *
  * To add a validator function, push to the corresponding array a ValidatorDefinition object: 
  *
  * type ValidatorDefinition = { name: string, validator: <T extends string | Cell>(v: T) => boolean, errorMessage: string }
  * 
  * If a validator function returns false, the errors hash will be updated
  * with a property name matching the name of the validator that returned false, 
  * 
  * The errors arrays contain ValidationError types 
  *
  * type ValidationError = { name: string, errorMessage: string }
  */
  .value('mtValidation', function mtValidation() {
    return {
      validators: {},
      errors: {},
      addValidatorFor: function addValidatorFor(target) {
        var self = this;
        return function addValidator(validatorDef) {
          self.validators[target] = self.validators[target] || [];
          if (typeof validatorDef.validator !== 'function' || !validatorDef.validator.call) {
            throw new MutableTableError('You must provide a validator function');
          }
          self.validators[target].push(validatorDef);
        }
      },
      validateFor: function validateFor(target) {
        var self = this;
        return function validate(val) {
          self.validators[target] = self.validators[target] || [];
          self.errors[target] = self.errors[target] || [];
          self.validators[target].forEach(function(validatorDef) {
            var validator = validatorDef.validator,
                name = validatorDef.name,
                error = validatorDef.errorMessage;
            if (false === validator(val)) {
              self.errors[target].push({
                name: name,
                errorMessage: error || 'There was an error'
              });
            }
          });
        }
      },
      clearErrorsFor: function clearFor(target) {
        var self = this;
        return function clearErrors() {
          delete self.errors[target];
        }
      },
      clear: function() {
        this.errors = {};
      },
      // Helper that returns an object with all 3 main functions for a given target 
      createValidatorFor: function createValidatorFor(target) {
        var self = this;
        return {
          add: this.addValidatorFor(target),
          validate: this.validateFor(target),
          clear: this.clearErrorsFor(target),
          get errors() {
            return self.errors[target];
          }
        };
      }
    };
  })

  .value('mtP2pLinkFactory', function mtP2pLinkFactoryFactory() {
    return function(scope, elem, attr, [form]) {
      let parent, mtP2pNamespace;
      if (!attr.mtP2pNamespace || attr.mtP2pNamespace === "") {
        throw new MutableTableError('mt-p2p-namespace attribute is required');
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

  .directive('mtDefaultCellValue', [
    '$timeout',
    function mtDefaultValueFactory($timeout) {
      return {
        restrict: 'A',
        require: 'mtMutableTable',
        link: link
      };
      function link(scope, elem, attrs, mtMutableTable) {
        if (!attrs.mtDefaultCellValue) {
          throw new Error('No default cell value provided');
        }
        $timeout(function() {
          mtMutableTable.defaultCellValue = attrs.mtDefaultCellValue;
        });
      }
    }
  ])

  .factory('mtDefaultVectorDirectiveFactory', [
    '$timeout',
    function mtDefaultVectorDirectiveFactoryFactory($timeout) {
      return function mtDefaultVectorDirectiveFactory(config) {
        var attribute = config.attribute,
            target = config.target;
        return {
          restrict: 'A',
          require: 'mtMutableTable',
          link: link
        };
        function link(scope, elem, attrs, mtMutableTable) {
          $timeout(function() {
            attrs[attribute].split('|').forEach(function(val) {
              // If the string is a valid <target>, push it on 
              // link.
              if (mtMutableTable[target].indexOf(val) < 0) {
                mtMutableTable[target].push(val);
              }
            });
          });
        }
      }
    }
  ])

  .factory('mtLockVectorDirectiveFactory', [
    '$timeout',
    function mtLockVectorDirectiveFactoryFactory($timeout) {
      return function mtLockVectorDirectiveFactory(config) {
        var attribute = config.attribute;
        return {
          restrict: 'A',
          require: 'mtMutableTable',
          link: link
        };
        function link(scope, elem, attrs, mtMutableTable) {
          if (!attrs[attribute]) {
            throw new MutableTableError('Missing attribute');
          }
          $timeout(function() {
            attrs[attribute].split('|').forEach(function(val) {
              switch (attribute) {
                case 'columnHeads': 
                  mtMutableTable.lockColumn(val);
                  break;
                case 'rowStubs':
                  mtMutableTable.lockRow(val);
                  break;
              }
            });
          });
        }
      }
    }
  ])

  .directive('mtDefaultColumns', [
    'mtDefaultVectorDirectiveFactory',
    function mtDefaultColumnsFactory(mtDefaultVectorDirectiveFactory) {
      return mtDefaultVectorDirectiveFactory({
        target: 'columnHeads',
        attribute: 'mtDefaultColumns'
      });
    }
  ])

  .directive('mtDefaultRows', [ 
    'mtDefaultVectorDirectiveFactory',
    function mtDefaultRowsFactory(mtDefaultVectorDirectiveFactory) {
      return mtDefaultVectorDirectiveFactory({
        target: 'rowStubs',
        attribute: 'mtDefaultRows'
      });
    }
  ])

  .directive('mtLockColumns', [
    '$timeout',
    function mtLockColumnsFactory(mtLockVectorDirectiveFactory) {
      return mtLockVectorDirectiveFactory({
        attribute: 'mtLockColumns'
      });
    }
  ])

  .directive('mtLockRows', [
    'mtLockVectorDirectiveFactory', 
    function mtLockRowsFactory(mtLockVectorDirectiveFactory) {
      return mtLockVectorDirectiveFactory({
        attribute: 'mtLockRows'
      });
    }
  ])

  .directive('mtMutableTable', [
    '$parse',
    '$timeout',
    function mtMutableTableFactory($parse, $timeout) {
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
                  
                  // Bound checkbox label for when no forms are active, and 
                  // checkbox position is left
                  '<span ng-show="(showCheckbox && !mt.busy) && ((cell.checked && checkboxCheckedTextPosition === \'left\') || (!cell.checked && checkboxUncheckedTextPosition === \'left\'))">{{cell.checked ? checkboxCheckedText : checkboxUncheckedText}}</span>' +
                  
                  // Bound cell value for display when no forms are active
                  '<span ng-show="!rowForm.$visible && !getColumnForm(\'columnForm\' + $index).$visible">{{cell.value}}</span>' + 
                  
                  // Checkbox bound to column form
                  '<span ng-if="showCheckbox && getColumnForm(\'columnForm\' + $index).$visible" e-class="mt-cell-checkbox" editable-checkbox="cell.checked" e-form="getColumnForm(\'columnForm\' + $index)" e-name="{{\'checkbox\' + tableModel.indexOf(rowObj)}}"></span>' + 
                  '<span ng-show="showCheckbox && getColumnForm(\'columnForm\' + $index).$visible">{{getColumnForm(\'columnForm\' + $index).$data[\'checkbox\' + tableModel.indexOf(rowObj)] ? checkboxCheckedText : checkboxUncheckedText}}</span>' +
                  
                  // Checkbox bound to row form
                  '<span ng-if="showCheckbox && rowForm.$visible" e-class="mt-cell-checkbox" editable-checkbox="cell.checked" e-form="rowForm" e-name="{{\'checkbox\' + $index}}"></span>' + 
                  '<span ng-show="showCheckbox && rowForm.$visible">{{rowForm.$data[\'checkbox\' + $index] ? checkboxCheckedText : checkboxUncheckedText}}</span>' +
                  
                  // Bound editable text for row form
                  '<span ng-show="rowForm.$visible" editable-text="cell.value" e-form="rowForm" e-name="{{\'text\' + $index}}" onbeforesave="validateBeforeSave(getScope().$parent, {$data: $data, cell: cell})">{{cell.value}}</span>' + 
                  
                  // Bound editable text for column form
                  '<span ng-show="getColumnForm(\'columnForm\' + $index).$visible" editable-text="cell.value" e-form="getColumnForm(\'columnForm\' + $index)" e-name="{{\'text\' + tableModel.indexOf(rowObj)}}" onbeforesave="validateBeforeSave(getScope().$parent, {$data: $data, cell: cell})">{{cell.value}}</span>' +
                  
                  // Bound checkbox label for when no forms are active, and 
                  // checkbox position is right
                  '<span ng-show="(showCheckbox && !mt.busy) && ((cell.checked && checkboxCheckedTextPosition === \'right\') || (!cell.checked && checkboxUncheckedTextPosition === \'right\'))">{{cell.checked ? checkboxCheckedText : checkboxUncheckedText}}</span>' +
                  
                  // Fill left and right controls for row form
                  '<button ng-show="rowForm.$visible && $index > 0" type="button" class="{{fillBtnClass}}" ng-click="fillLeft($index, rowForm)">&#8592;</button>' +
                  '<button ng-show="rowForm.$visible && $index < rowObj.cells.length - 1" type="button" class="{{fillBtnClass}}" ng-click="fillRight($index, rowForm)">&#8594;</button>' +
                  
                  // Fill up and down controls for column form
                  '<button type="button" ng-show="getColumnForm(\'columnForm\' + $index).$visible && tableModel.indexOf(rowObj) > 0" class="{{fillBtnClass}}" ng-click="fillLeft(tableModel.indexOf(rowObj), getColumnForm(\'columnForm\' + $index))">&#8593;</button>' +
                  '<button type="button" ng-show="getColumnForm(\'columnForm\' + $index).$visible && tableModel.indexOf(rowObj) < tableModel.length - 1" class="{{fillBtnClass}}" ng-click="fillRight(tableModel.indexOf(rowObj), getColumnForm(\'columnForm\' + $index))">&#8595;</button>' +
                '</td>' +
              '</tr>' +
            '</tbody>' +
          '</table>';
      return {
        restrict: 'E',
        controller: ['$scope', '$attrs', '$timeout', 'mtValidation', controller],
        scope: true,
        controllerAs: 'mt',
        link: link,
        template: template
      }

      function controller($scope, $attrs, $timeout, mtValidation) {
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
        hooks = {},
        
        /**
         * Root validation instance
         */
        validatorRoot = mtValidation();

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
          },
          locks: {
            get: function() {
              // Manually create a deep read-only obj by breaking ref
              return {
                column: $scope.locks.column.slice(),
                row: $scope.locks.row.slice(),
                cells: angular.copy($scope.locks.cells)
              };
            }
          },
          errors: {
            get: function() {
              return validatorRoot.errors;
            }
          }
        });

        /**
         * Validators that are checked on each digest cycle.
         * See the link function.
         */
        self.validators = {
          columns: validatorRoot.createValidatorFor('columns'),
          rows: validatorRoot.createValidatorFor('rows'),
          cells: validatorRoot.createValidatorFor('cells')
        };

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

        self.defaultCellValue = "";
        
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
        
        /**
         * Publish the root validators instance to the directive's scope
         */
        $scope.validatorRoot = validatorRoot;

        // @Public methods

        self.setHook = setHook;
        self.removeHook = removeHook;
        self.init = init;
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
        self.lockColumn = lockFactory('column');
        self.lockRow = lockFactory('row');
        self.unlockColumn = unlockFactory('column');
        self.unlockRow = unlockFactory('row');
        self.isLockedColumn = isLockedFactory('column');
        self.isLockedRow = isLockedFactory('row');

        initHooks();

        /**
         * Setup the hooks 
         */
        function initHooks() {
          hooks = {};
          [
            'afterSave',
            'beforeRemove',
            'afterRemove',
            'afterCancel',
            'afterInitFromCells',
            'beforeRender',
            'afterRender',
            'beforeInit',
            'afterInit'
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
            throw new MutableTableError('Hook must be typeof "function"');
          }
          if (!hooks[name]) {
            throw new MutableTableError('Unknown hook ' + name);
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

        function lockFactory(target) {
          return function lock(name) {
            if ($scope.locks[target].indexOf(name) < 0) {
              $scope.locks[target].push(name);
            }
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
                  value: self.defaultCellValue
                });
              }
            }
          } 
          storeLockedCells(cells);
        }

        /**
         * Store a cell in the $scope.locks.cells cache.
         * Pass true as the 2nd argmument to have the locked cells 
         * removed from the original source array (argument 1).
         * 
         * @param {*} cells 
         * @param {*} removeFromSrc 
         */
        function storeLockedCells(cells, removeFromSrcArr) {
          worker(0);
          function worker(currentIdx) {
            var c, ch, rs, cellSearchResult;
            for (var i = currentIdx; i < cells.length; ++i) {
              c = cells[i];
              ch = c.columnHead;
              rs = c.rowStub;
              if (
                self.isLockedColumn(ch) 
                && self.isLockedRow(rs)
              ) {
                cellSearchResult = findCellFor(ch, rs, $scope.locks.cells);
                $scope.locks.cells.splice(cellSearchResult.index, +!!cellSearchResult.cell, c);
                // If we need to remove locked cell from original array:
                if (removeFromSrcArr === true) {
                  cells.splice(i, 1);
                  worker(i);
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
              (
                // Check if the columnHead that the cell belongs no longer exists
                columnHeads.indexOf(cells[cc].columnHead) === -1
                // Or if the rowStub that the cell belongs to no longer exists
                || rowStubs.indexOf(cells[cc].rowStub) === -1
              )
              // And checks if the corresponding columnHead or rowStub do not 
              // belong to locked rows/columns
              && !(
                self.isLockedColumn(cells[cc].columnHead)
                || self.isLockedRow(cells[cc].rowStub)
              )
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
              tableModel;
          hooks.beforeRender();
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
          hooks.afterRender();
        }
        
        /**
         * Initialize using the existing cells.
         * This is useful for when you modify the cells directly and 
         * need to re-render the table.
         * NOTE: A simple watch expression could handle this task reactively,
         * however it's not a common case, so I've left it to this method 
         * and the consumer to call it manually after altering the cells.
         */
        function init() {
          initFromCells(self.cells);
        }

        /**
         * Initialize the table with a passed array of cells.
         */
        function initFromCells(cells) {
          hooks.beforeInit();
          self.columnHeads = [];
          self.rowStubs = [];
          $timeout(function() {
            // At this point, any new cells that would correspond to columnHeads or rowStubs
            // should be removed (unless they are locked).

            // Now lock any new cells that correspond to locked columnHeads or rowStubs
            // By passing true as the 2nd arg, we are also removing those cells from 
            // the original array (to prevent duplicates when we concatenate the arrays afterward).
            storeLockedCells(cells, true);
            // Then reset the cells
            self.cells = cells.concat($scope.locks.cells);
            applyCells(self.cells);
            hooks.afterInit();
            self.render();

            function applyCells(cells) {
              cells.forEach(function(cell) {
                if (!cell.columnHead || !cell.rowStub) {
                  throw new MutableTableError('Unable to initialize table; invalid cell structure detected.');
                }
                if (self.columnHeads.indexOf(cell.columnHead) === -1) {
                  self.columnHeads.push(cell.columnHead);
                }
                if (self.rowStubs.indexOf(cell.rowStub) === -1) {
                  self.rowStubs.push(cell.rowStub);
                }
              });
            }
          });
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

        function findCellFor(columnHead, rowStub, searchIn) {
          var cell = searchIn.filter(function(cell) {
            return cell.columnHead === columnHead && cell.rowStub === rowStub;
          })[0];
          return {
            cell: cell,
            index: searchIn.indexOf(cell)
          };
        }
      }
      
      // Getting pretty big :/
      // Considering a rewrite that uses an isolate scope instead of manually working with attrs.
      // Or, abstract some of the attributes into separate directives.
      function link(scope, elem, attrs, ctrl) {
        // Properties and methods
        scope.xeditableFormActive = false;
        scope.xeditableFormToggle = xeditableFormToggle.bind(scope);
        scope.startWatching = startWatching.bind(scope);
        scope.stopWatching = stopWatching.bind(scope);
        scope.fillLeft = fillEditables(function(targetNum, matchNum) {
          return targetNum < matchNum;
        }).bind(scope);
        scope.fillRight = fillEditables(function(targetNum, matchNum) {
          return targetNum > matchNum;
        }).bind(scope);
        scope.appendTo = appendTo.bind(scope);
        scope.getColumnForm = getColumnForm.bind(scope);
        scope.closeAllForms = closeAllForms.bind(scope);
        scope.getScope = getScope.bind(scope);
        scope.checkIfColumnLocked = checkIfLockedFactory('column').bind(scope);
        scope.checkIfRowLocked = checkIfLockedFactory('row').bind(scope);

        // Bind attributes to scope

        // Classes/id .. probably not the best approach lul
        // TODO: Switch to hard-coded classes and id and allow the user 
        // to just use CSS 
        scope.mt.rowsHeader = scope.mt.rowsHeader || attrs.mtRowsHeader || "";
        scope.tableClass = attrs.mtTableClass || "";
        scope.tableId = attrs.mtTableId || "";
        scope.editBtnClass = attrs.mtBtnClass || attrs.mtEditBtnClass || "";
        scope.saveBtnClass = attrs.mtBtnClass || attrs.mtSaveBtnClass || "";
        scope.cancelBtnClass = attrs.mtBtnClass || attrs.mtCancelBtnClass || "";
        scope.removeBtnClass = attrs.mtBtnClass || attrs.mtRemoveBtnClass || "";
        scope.fillBtnClass = attrs.mtBtnClass || attrs.mtFillBtnClass || "";
        
        // Disable the edit buttons
        scope.disableEdit = expressionFactory(attrs.mtDisableEdit);
        scope.disableEditColumns = expressionFactory(attrs.mtDisableEditColumns, {
          $columnHeads: ctrl.columnHeads
        });
        scope.disableEditRows = expressionFactory(attrs.mtDisableEditRows, {
          $rowStubs: ctrl.rowStubs
        });

        // TODO: Maybe swap words "disableRemove" with "lock" to be more consistent with new lock feature.
        scope.disableRemoveColumns = expressionFactory(attrs.mtDisableRemoveColumns, {
          $columnHeads: ctrl.columnHeads
        });
        scope.disableRemoveRows = expressionFactory(attrs.mtDisableRemoveRows, {
          $rowStubs: ctrl.rowStubs
        });
        scope.disableRemove = expressionFactory(attrs.mtDisableRemove);
        
        // xeditable onbeforesave validator
        scope.validateBeforeSave = $parse(attrs.mtValidateBeforeSave);

        // Set transform expressions for the column head/row stub prefixes
        scope.columnHeadPrefixTransform = attrs.mtColumnHeadPrefixTransform;
        scope.rowStubPrefixTransform = attrs.mtRowStubPrefixTransform;

        // Enable and configure the cell checkboxes
        scope.showCheckbox = attrs.mtShowCheckbox === 'true' ? true : false;
        scope.checkboxCheckedText = attrs.mtCheckboxCheckedText;
        scope.checkboxUncheckedText = attrs.mtCheckboxUncheckedText;
        scope.checkboxCheckedTextPosition = attrs.mtCheckboxCheckedTextPosition || 'left';
        scope.checkboxUncheckedTextPosition = attrs.mtCheckboxUncheckedTextPosition || 'left';
        

        scope.startWatching();

        function startWatching() {
          this.dereg = [
            this.$watch('mt.columnHeads', rowStubOrColumnHeadChange.bind(scope), true),
            this.$watch('mt.rowStubs', rowStubOrColumnHeadChange.bind(scope), true),
            this.$watch('mt.cells', cellChange, true)
          ];
        }
        
        function stopWatching() {
          this.dereg.forEach(function(dereg) {
            dereg();
          });
        }
        
        function cellChange() {
          ctrl.validators.cells.clear();
          ctrl.validators.cells.validate(ctrl.cells);
        }

        // Main handler for row or column changes.
        function rowStubOrColumnHeadChange(newVal, oldVal) {
          let self = this,
              newLength = newVal.length,
              oldLength = oldVal.length;
          
          self.xeditableFormActive = false;
          self.closeAllForms();

          // Values are the same during initialization
          if (newVal === oldVal) {
            return;
          }
          if (newLength > oldLength) {
            ctrl.addCells();
          }
          else if (newLength < oldLength) {
            ctrl.removeCells();
          }

          // Perform validation; start by clearing prior validation errors
          scope.validatorRoot.clear();
          ctrl.validators.columns.validate(ctrl.columnHeads);
          ctrl.validators.rows.validate(ctrl.rowStubs);
          ctrl.validators.cells.validate(ctrl.cells);
          
          // Reset active editable forms and render new model
          resetLockedColumnsAndRows();
          ctrl.render();
        }

        function resetLockedColumnsAndRows() {
          [scope.locks.column, scope.locks.row].forEach(function(lockedArr, i) {
            var target = ['columnHeads', 'rowStubs'][i];
            lockedArr.forEach(function(val) {
              if (ctrl[target].indexOf(val) < 0) {
                ctrl[target].push(val);
              }
            });
          })
        }
        
        function fillEditables(strategy) {
          return function(num, form) {
            num = parseInt(num);
            var editables = form.$editables,
                textTargets = [],
                checkboxTargets = [],
                editable,
                targetNameText,
                targetNameNum,
                textValue,
                checkboxValue;
  
            for (var i = 0; i < editables.length; ++i) {
              editable = editables[i];
              targetNameText = getText(editable.name);
              targetNameNum = getNum(editable.name);

              // Editable to copy text value from
              if (editable.name === 'text' + num) {
                textValue = editable.scope.$data;
                continue;
              }

              // Editable to copy checkbox value from
              if (editable.name === 'checkbox' + num) {
                checkboxValue = editable.scope.$data;
                continue;
              }
              
              if (strategy(targetNameNum, num)) {
                // Text editables
                if (targetNameText === 'text') {
                  textTargets.push(editable);
                }
                // Checkbox editables
                else if (targetNameText === 'checkbox') {
                  checkboxTargets.push(editable);
                }
              }
            }
  
            textTargets.forEach(function(editable) {
              editable.scope.$data = textValue;
            });
            checkboxTargets.forEach(function(editable) {
              editable.scope.$data = checkboxValue;
            });
            
            function getText(name) {
              return name.match(/[a-zA-Z]+/)[0];
            }
  
            function getNum(name) {
              return parseInt(name.match(/[0-9]+/)[0]);
            }  
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
        *
        * Only use when you can pass locals accessible in link, controller, etc.
        * If the required locals are only accessible in the template, just us $parse manually.
        * @param {*} optionalExp 
        */
        function expressionFactory(optionalExp, locals) {
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