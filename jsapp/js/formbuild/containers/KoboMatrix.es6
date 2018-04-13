import React from 'react';
import autoBind from 'react-autobind';
import { bemComponents } from 'js/libs/reactBemComponents';
import { t } from '../../utils';
import { sluggify, txtid } from '../../../xlform/src/model.utils';
import { Map } from 'immutable';
import Select from 'react-select';
import alertify from 'alertifyjs';

const bem = bemComponents({
  Matrix: 'kobomatrix',
  MatrixCols: 'matrix-cols',
  MatrixCols__col: 'matrix-cols__col',
  MatrixCols__settings: 'matrix-cols__settings',
  MatrixCols__settings_inner: 'matrix-cols__settings_inner',
  MatrixCols__colattr: ['matrix-cols__colattr', '<span>'],
  MatrixItems: ['matrix-items', '<ul>'],
  MatrixItemsNewCol: ['matrix-items-new'],
  MatrixItems__item: ['matrix-items__item', '<li>'],
  MatrixItems__itemrow: ['matrix-items__itemrow'],
  MatrixItems__itemattr: ['matrix-items__itemattr', '<span>'],
  MatrixItems__itemsettings: ['matrix-items__itemsettings'],
  MatrixButton: ['kobomatrix-button', '<button>'],
});

class KoboMatrix extends React.Component {
  constructor (props) {
    super(props);
    this._listDetails = {};

    this.state = {
      data: props.model.data,
      kuid: props.model.kuid,
      kobomatrix_list: props.model.kobomatrix_list,
      expandedColKuid: false,
      expandedRowKuid: false,
      typeChoices: [
        {
          value: 'select_one',
          label: t('Select One')
        },
        {
          value: 'select_many',
          label: t('Select Many')
        },
        {
          value: 'text',
          label: t('Text')
        },
        {
          value: 'integer',
          label: t('Number')
        },
      ]
    };
    autoBind(this);
  }

  componentDidMount() {
    const data = this.state.data;
    const kuid = this.state.kuid;
    localStorage.setItem(`koboMatrix.${kuid}`, JSON.stringify(data.toJS()));

    // generate cols/rows for a new matrix
    if (data.get('cols').size < 1 && data.get('choices').size < 1) {
      this.generateDefault();
    }
  }

  generateDefault() {
    // TODO: find a better way to do this
    this.newColumn();
      window.setTimeout(()=>{
        this.newColumn();
        window.setTimeout(()=>{
          this.newChoiceOption(false);
        }, 500); 
      }, 500); 
  }

  expandColumn(colKuid) {
    if (this.state.expandedColKuid === colKuid )
      this.setState({expandedColKuid: false});
    else
      this.setState({expandedColKuid: colKuid, expandedRowKuid: false});
  }

  expandRow(rowKuid) {
    if (this.state.expandedRowKuid === rowKuid )
      this.setState({expandedRowKuid: false});
    else
      this.setState({expandedRowKuid: rowKuid, expandedColKuid: false});
  }


  autoName(val, type, ln = false) {
    var names = [];
    const kobomatrix_list = this.state.kobomatrix_list;
    var data = this.state.data;

    if (type === 'column') {
      data.get('cols').forEach(function(ch){
        names.push(data.getIn([ch, '$autoname']));
      });
    } else {
      data.get('choices').forEach(function(ch){
        if (ch.get('list_name') == ln)
          names.push(ch.get('$autovalue'));
      });
    }

    return sluggify(val, {
      preventDuplicates: names,
      lowerCase: true,
      lrstrip: true,
      preventDuplicateUnderscores: true,
      characterLimit: 14,
      incrementorPadding: false,
      validXmlTag: false,
      replaceNonWordCharacters: true
    });
  }

  rowChange(e) {
    const rowKuid = this.state.expandedRowKuid, 
          type = e.target.getAttribute('data-type');
    var data = this.state.data;
    var val = e.target.value;

    if (type === 'label') {
      data = data.setIn(['choices', rowKuid, type], val);
    }

    if (type === 'name') {
      val = this.autoName(val, false, this.state.kobomatrix_list);
      data = data.setIn(['choices', rowKuid, 'name'], val);
      data = data.setIn(['choices', rowKuid, '$autovalue'], val);
    }

    this.setState({data: data});
    this.toLocalStorage(data);
  }

  colChange(e) {
    const colKuid = this.state.expandedColKuid;
    var data = this.state.data;
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    const type = e.target.getAttribute('data-type');
    data = data.setIn([colKuid, type], val);

    this.setState({data: data});
    this.toLocalStorage(data);
  }

  colChangeType(e) {
    const colKuid = this.state.expandedColKuid;
    var data = this.state.data;
    const newType = e.value;
    const prevType = data.getIn([colKuid, 'type']);
    var _this = this;

    // warn only if existing column type is one of (Select One, Select Many)
    // and new type is NOT one of (Select One, Select Many)
    if (['select_one', 'select_many'].includes(prevType) && !['select_one', 'select_many'].includes(newType)) {
      let dialog = alertify.dialog('confirm');
      let opts = {
        title: t('Change column type?'),
        message: t('Are you sure you want to change the type? This action is irreversible, your existing option choices will be erased.'),
        labels: {ok: t('Change type'), cancel: t('Cancel')},
        onok: (evt, val) => {
          data = data.setIn([colKuid, 'type'], newType);
          data = data.deleteIn([colKuid, 'select_from_list_name']);
          _this.setState({data: data});
          _this.toLocalStorage(data);    
        },
        oncancel: () => {
          dialog.destroy();
        }
      };
      dialog.set(opts).show();
    } else {
      data = data.setIn([colKuid, 'type'], newType);
      const prevListName = data.getIn([colKuid, 'select_from_list_name']);
      if (['select_one', 'select_many'].includes(newType) && prevListName === undefined) {
        const newListId = txtid();
        data = _this._addDefaultList(data, newListId);
        data = data.setIn([colKuid, 'select_from_list_name'], newListId);
      }
      _this.setState({data: data});
      _this.toLocalStorage(data);    
    }
  }

  _addDefaultList(data, newListId) {
    const choice1kuid = txtid();
    const val1 = this.autoName(t('Option 1'), false, newListId);

    const choice1 = Map({
        label: t('Option 1'),
        $autovalue: val1,
        name: val1,
        $kuid: choice1kuid,
        list_name: newListId
      });
    data = data.setIn(['choices', choice1kuid], choice1);

    const val2 = this.autoName(t('Option 2'), false, newListId);
    const choice2kuid = txtid();
    const choice2 = Map({
        label: t('Option 2'),
        $autovalue: val2,
        name: val2,
        $kuid: choice2kuid,
        list_name: newListId
      });
    data = data.setIn(['choices', choice2kuid], choice2);
    return data;
  }

  choiceChange(e) {
    const kuid = e.target.getAttribute('data-kuid'), 
          type = e.target.getAttribute('data-type');
    var data = this.state.data;
    var val = e.target.value;

    if (type === 'label') {
      data = data.setIn(['choices', kuid, type], val);
    }

    if (type === 'name') {
      val = this.autoName(val, false, kuid);
      data = data.setIn(['choices', kuid, 'name'], val);
      data = data.setIn(['choices', kuid, '$autovalue'], val);
    }

    this.setState({data: data});
    this.toLocalStorage(data);
  }

  getCol(colKuid, field) {
    return this.state.data.getIn([colKuid, field]);
  }

  getChoiceField(kuid, field) {
    return this.state.data.getIn(['choices', kuid, field]);
  }

  getRequiredStatus(colKuid) {
    const val = this.state.data.getIn([colKuid, 'required']);
    return val == true || val == 'true' ? true : false;
  }

  newChoiceOption(e) {
    var data = this.state.data, 
        listName = null;
    if (e && e.target) {
      listName = e.target.getAttribute('data-list-name');
    } else {
      listName = this.state.kobomatrix_list;
    }

    const val = this.autoName(t('Row'), false, listName);
    const newRowKuid = txtid();
    const newRow = Map({
      label: t('Row'),
      $autovalue: val,
      name: val,
      $kuid: newRowKuid,
      list_name: listName
    });

    data = data.setIn(['choices', newRowKuid], newRow);
    this.setState({data: data});
    this.toLocalStorage(data);
  }

  newColumn() {
    var data = this.state.data;
    const newColKuid = txtid();
    const cname = this.autoName(t('Column'), 'column');
    const newCol = Map({
      $autoname: cname,
      $kuid: newColKuid,
      appearance: "w1",
      constraint: "",
      constraint_message: "",
      default: "",
      hint: "",
      label: t('Column'),
      name: cname,
      relevant: "",
      required: "false",
      type: "text",
    });

    data = data.set(newColKuid, newCol);
    data = data.update('cols', list => list.push(newColKuid));

    this.setState({data: data});
    this.toLocalStorage(data);
  }

  deleteRow(e) {
    const rowKuid = e.target.getAttribute('data-kuid');
    var _this = this;
    let dialog = alertify.dialog('confirm');
    let opts = {
      title: t('Delete row?'),
      message: t('Are you sure you want to delete this row? This action cannot be undone.'),
      labels: {ok: t('Delete'), cancel: t('Cancel')},
      onok: (evt, val) => {
        const data = _this.state.data.deleteIn(['choices', rowKuid]);
        _this.setState({data: data});
        _this.toLocalStorage(data);    
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
  }

  deleteColumn(e) {
    const colKuid = this.state.expandedColKuid;
    var data = this.state.data;
    var _this = this;
    let dialog = alertify.dialog('confirm');
    let opts = {
      title: t('Delete column?'),
      message: t('Are you sure you want to delete this column? This action cannot be undone.'),
      labels: {ok: t('Delete'), cancel: t('Cancel')},
      onok: (evt, val) => {
        data = data.update('cols', cols => cols.filterNot(x => x === colKuid));
        _this.setState({data: data, expandedColKuid: false});
        _this.toLocalStorage(data);    
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
  }

  toLocalStorage(data) {
    const dataJS = data.toJS();
    localStorage.setItem(`koboMatrix.${this.state.kuid}`, JSON.stringify(dataJS));    
  }

  getListDetails (listName) {
    const list = this.state.data.get('choices');
    var _list = [];

    list.forEach(function(item){
      if (item.get('list_name') == listName)
        _list.push(item.toJS());
    });

    return _list;
  }

  render () {
    const data = this.state.data;
    const cols = data.get('cols'),
          choices = data.get('choices'),
          expandedCol = this.state.expandedColKuid, 
          expandedRow = this.state.expandedRowKuid;
    var _this = this;

    var items = this.getListDetails(this.state.kobomatrix_list);

    return (
        <bem.Matrix>
          <bem.MatrixCols m={'header'}>
            <bem.MatrixCols__col m={'label'} key={'label'}></bem.MatrixCols__col>
            {
              cols.map(function(colKuid, n) {
                let col = data.get(colKuid);
                return (
                    <bem.MatrixCols__col key={n} m={'header'}
                      className={expandedCol === colKuid ? 'active' : ''}>
                      <bem.MatrixCols__colattr m={'label'}>
                        {col.get('label')}
                      </bem.MatrixCols__colattr>
                      <bem.MatrixCols__colattr m={'type'}>
                        {col.get('type')}
                      </bem.MatrixCols__colattr>
                      <i className="k-icon-settings" onClick={_this.expandColumn.bind(this, colKuid)} />
                    </bem.MatrixCols__col>
                  );
              })
            }
          </bem.MatrixCols>
          <bem.MatrixCols__settings className={expandedCol ? 'expanded' : ''}>
            { expandedCol &&
              <bem.MatrixCols__settings_inner>
                <label>
                  <span>{t('Response Type')}</span>
                  <Select value={this.getCol(expandedCol, 'type')}
                    clearable={false}
                    options={this.state.typeChoices}
                    onChange={this.colChangeType} />
                </label>
                <label>
                  <span>{t('Label')}</span>
                  <input type="text" value={this.getCol(expandedCol, 'label')}
                    onChange={this.colChange} 
                    className="js-cancel-sort"
                    data-type='label' />
                </label>
                <label>
                  <span>{t('Data Column Suffix')}</span>
                  <input type="text" value={this.getCol(expandedCol, 'name')}
                    onChange={this.colChange} 
                    className="js-cancel-sort"
                    data-type='name' />
                </label>
                <label>
                  <span>{t('Required')}</span>
                  <input type="checkbox" 
                    id={`required-${expandedCol}`}
                    name={`required-${expandedCol}`}
                    checked={this.getRequiredStatus(expandedCol)}
                    onChange={this.colChange} 
                    className="js-cancel-sort"
                    data-type='required' />
                  <label htmlFor={`required-${expandedCol}`}></label>
                </label>
                {this.getCol(expandedCol, 'select_from_list_name') && 
                  <div className="matrix-cols__options">
                    <div className="matrix-cols__options--row-head">
                      <span>{t('Label')}</span>
                      <span>{t('Data Column Name')}</span>
                    </div>
                    {
                      choices.map(function(choice, ch) {
                        if (choice.get('list_name') == _this.getCol(expandedCol, 'select_from_list_name')) {
                          return (
                            <div className="matrix-cols__options--row" key={ch}>
                              <span>
                                <input type="text" value={_this.getChoiceField(ch, 'label')}
                                  onChange={_this.choiceChange} className="js-cancel-sort" 
                                  data-type='label' data-kuid={ch} />
                              </span>
                              <span className="matrix-options__value">
                                <input type="text" value={_this.getChoiceField(ch, 'name')}
                                  onChange={_this.choiceChange} className="js-cancel-sort" 
                                  data-type='name' data-kuid={ch} />
                              </span>
                              <span className="matrix-options__delete">
                                <i className="k-icon-trash" onClick={_this.deleteRow} data-kuid={ch} />
                              </span>
                            </div>
                          );
                        }
                      })
                    }
                    <div className="matrix-cols__options--row-foot">
                      <i className="k-icon-plus" onClick={this.newChoiceOption} data-list-name={this.getCol(expandedCol, 'select_from_list_name')}/>
                    </div>

                  </div>
                }
                <div className="matrix-cols__delete">
                  <span className="matrix-cols__delete-action" onClick={_this.deleteColumn}>{t('Delete column')} <i className="k-icon-trash" /></span>
                </div>
              </bem.MatrixCols__settings_inner>
            }
          </bem.MatrixCols__settings>
          <bem.MatrixItems>
            {
              items.map(function(item, n) {
                return (
                  <bem.MatrixItems__item key={n}>
                    <bem.MatrixItems__itemrow>
                      <bem.MatrixItems__itemattr m={'label'}>
                        <label>{item.label}</label>
                        <i className="k-icon-settings" onClick={_this.expandRow.bind(this, item.$kuid)} />
                      </bem.MatrixItems__itemattr>
                      {
                        cols.map(function(colKuid, nn) {
                          const col = data.get(colKuid),
                            _listName = col.get('select_from_list_name'),
                            _type = col.get('type');

                          let _isUnderscores = false,
                            contents = [];
                          if (_listName) {
                            let list = _this.getListDetails(_listName);
                            let listStyleChar = '🔘';
                            list.forEach(function(item){
                              contents.push(`${listStyleChar} ${item.label}`);
                            });
                          } else {
                            _isUnderscores = true;
                            contents = ['_________'];
                          }
                          return (
                            <bem.MatrixCols__col key={colKuid} m={{
                              list: !!_listName,
                              underscores: _isUnderscores,
                            }}>
                              {contents.join(' ')}
                            </bem.MatrixCols__col>
                          );
                        })
                      }
                    </bem.MatrixItems__itemrow>
                    <bem.MatrixItems__itemsettings className={expandedRow === item.$kuid ? 'expanded' : ''}>
                      { expandedRow && 
                        <bem.MatrixCols__settings_inner>
                          <label>
                            <span>{t('Label')}</span>
                            <input type="text" value={item.label}
                               onChange={_this.rowChange} 
                               className="js-cancel-sort"
                               data-type='label' />
                          </label>
                          <label>
                            <span>{t('Data Column Prefix')}</span>
                            <input type="text" value={item.name}
                               onChange={_this.rowChange} 
                               className="js-cancel-sort"
                               data-type='name' />
                          </label>
                          <div className="matrix-cols__delete">
                            <span className="matrix-cols__delete-action" onClick={_this.deleteRow} data-kuid={item.$kuid}>
                              {t('Delete row')} <i className="k-icon-trash" />
                            </span>
                          </div>
                        </bem.MatrixCols__settings_inner>
                      }
                    </bem.MatrixItems__itemsettings>
                  </bem.MatrixItems__item>
                );
              })
            }
            <bem.MatrixItems__item key={'new'} m={'new'}>
              <i className="k-icon-plus" onClick={this.newChoiceOption} data-list-name={this.state.kobomatrix_list}/>
            </bem.MatrixItems__item>
          </bem.MatrixItems>
          <bem.MatrixItemsNewCol>
            <i className="k-icon-plus" onClick={this.newColumn} />
          </bem.MatrixItemsNewCol>
        </bem.Matrix>
      )
  }
}

export default KoboMatrix;