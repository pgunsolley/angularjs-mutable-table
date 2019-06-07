# Overview

This is not a comprehensive guide. 

I will update this file as time permits.

# Peer Dependencies

- AngularJS (^1.4.0)
- Angular-xeditable (^0.1.9)

# Module

mutable-table 

# Directives

## mtP2pForm 

Used internally; probably not needed for most use-cases. mtP2pForm publishes a form controller 
from the current scope onto the parent scope. 
The property name on the parent scope can be specified using the mtP2pNamespace attribute, which
sets an array as the value to the specified property name. 
If a namespace is not provided, an error will be thrown. 

```
<div ng-repeat="item in items>
  <form mt-p2p-form mt-p2p-namespace="childForms">
    // ... 
  </form>
</div>
```

The parent scope will now have a 'childForms' property that is an array, and each form cloned by ngRepeat
will be pushed into that array.

## mtMutableTable

A mutable table that can grow, shrink, and sort as needed by the app domain.
If a name attribute is provided, the controller will be published to the scope 
under that name. This is recommended, as it exposes core functionlaity.

```
<mt-mutable-table name="myMutableTable"/>
```

From the current controller, you may access the mutable table controller as expected ie: 
`$scope.myMutableTable`

### Public Properties Overview

- [columnHeads](#columnHeads)
- [rowStubs](#rowStubs)
- [cells](#cells)

### Public Methods Overview

- [initFromCells](#initFromCells)
- [addColumn](#addColumn)
- [removeColumn](#removeColumn)
- [addRow](#addRow)
- [removeRow](#removeRow)
- [addCells](#addCells)
- [removeCells](#removeCells)
- [render](#render)

### Public Properties

#### <a name="columnHeads">columnHeads</a>

An array of strings that define the column heads, in order. 
Modifications to this array are watched. 

You can add, remove and sort values.

Adding a new value will create a new column, and new cells will be generated.

Removing a value will remove cells in that column.

Sorting it will sort the columns.

```
$scope.myMutableTable.columnHeads.push("Foo"); 
// Adds a column under the Foo header

$scope.myMutableTable.columnHeads.push("Bar"); 
// Adds a column under the Bar header

$scope.myMutableTable.columnHeads.splice(0, 1); 
// Removes the column under the header "Foo"

$scope.myMutableTable.sort((a, b) => a < b ? -1 : 1); 
// Sorts the table columns by evaluating the values of the column heads
```

#### <a name="rowStubs">rowStubs</a>

Similar to columnHeads, but defines the row stubs. 

All of the same actions that can be performed on tableHeads can be performed 
on the row stubs in order to modify the table layout by row.

#### <a name="cells">cells</a>

An array of cell objects 

```
// Using TypeScript type alias
type cell = {
  columnHead: string,
  rowStub: string,
  value: string
}
```

Cells are the data model for each table cell :3 
The columnHead and rowStub meta define the cell's location.

Behind the scenes, cells are what define the structure and data of the mutable table.
In most cases, changes to the cells property should be avoided; it should be accessed as readonly for fetching table data as it is not watched. If you must modify the cells array directly, you will need to manually call the [render](#render) method to update the view.

### Public Methods

#### <a name="initFromCells">initFromCells</a>

Clears/resets the table and initializes it with the given cells.

```
$scope.myMutableTable.initFromCells(myCellsArray);
```

#### <a name="addColumn">addColumn</a>

A helper method that adds a new column head, generating new cells under that column.

```
$scope.myMutableTable.addColumn('Foo Column');
```

#### <a name="removeColumn">removeColumn</a>

A helper method that removes the column at a given (0-based) index.

```
$scope.myMutableTable.removeColumn(0);
```

#### <a name="addRow">addRow</a>

Same as [addColumn](#addColumn), but for rows.

#### <a name="removeRow">removeRow</a>

Same as [removeColumn](#removeColumn), but for rows.

#### <a name="addCells">addCells</a>

Generates missing cells for values in the columnHead or rowStub arrays.

#### <a name="removeCells">removeCells</a>

Removes cells that do not have corresponding values in the columnHead or rowStub arrays.

#### <a name="render">render</a>

Generates the tableModel object by referencing the [cells](#cells) objects, updating the table in the view.

If you make direct changes to the [cells](#cells) array, calling this method will render the changes to the view.