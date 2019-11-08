import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { FilteringLogic, IForOfState, SortingDirection } from 'igniteui-angular';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PRODUCTS_DATA } from 'src/localData/northwind';

// base URL for the API
const BASE_URL = 'http://localhost:8153/api.rsc';
// const BASE_URL = `https://igniteui-api.azurewebsites.net/api.rsc/`;
const FINDATA_URL = 'http://localhost:8153/api.rsc/Finstock_dbo_Exchange/';
const EMPTY_STRING = '';
const NULL_VALUE = null;
const authtoken = '2q3P0o4p9N9a7e2B9f8q';
const HTTP_OPTIONS = {
    headers : new HttpHeaders({
        'x-cdata-authtoken': authtoken
    })
};
export enum FILTER_OPERATION {
    CONTAINS = 'contains',
    STARTS_WITH = 'startswith',
    ENDS_WITH = 'endswith',
    EQUALS = 'eq',
    DOES_NOT_EQUAL = 'ne',
    DOES_NOT_CONTAIN = 'not contains',
    GREATER_THAN = 'gt',
    LESS_THAN = 'lt',
    LESS_THAN_EQUAL = 'le',
    GREATER_THAN_EQUAL = 'ge'
}

@Injectable()
export class RemoteDataService {
    public dataLength: BehaviorSubject<number>;
    public remoteData: Observable<any[]>;
    private _remoteData: BehaviorSubject<any[]>;

    constructor(private _http: HttpClient) {
        this._remoteData = new BehaviorSubject([]);
        this.remoteData = this._remoteData.asObservable();
        this.dataLength = new BehaviorSubject(0);
    }

    public getMetadata(table: string, cb?: (any) => void): any {
        return this._http.get(this._buildMetadataUrl(table), HTTP_OPTIONS).subscribe({
            next: (metadata: any) => {
                const names = metadata.items[0]['odata:cname'];
                const types = metadata.items[0]['odata:cdatatype'];
                this.prepareColumnsData(names, types, cb);
            },
            error: err => {
                const names = ['OrderID', 'OrderDate', 'ShipCountry', 'Freight'];
                const types = ['number', 'string', 'string', 'string'];
                this.prepareColumnsData(names, types, cb);
            }
        });
    }

    private prepareColumnsData(fields: string[], types: string[], cb) {
        const columns = [];

        for (let i = 0; i < fields.length; i++) {
            columns.push({ field: fields[i], type: (types[i] === 'string' ? 'string' : 'number') });
        }

        if (cb) {
            cb(columns);
        }
    }

    public getData(
        table: string,
        virtualizationArgs?: IForOfState,
        filteringArgs?: any,
        sortingArgs?: any, cb?: (any) => void): any {
        return this._http.get(this.buildDataUrl(
            table, null, null, virtualizationArgs, filteringArgs, sortingArgs), HTTP_OPTIONS)
            .pipe(
                catchError(this.handleError)
            );
    }

    public bindLocalData() {
        this._remoteData.next(PRODUCTS_DATA);
        this.dataLength.next(PRODUCTS_DATA.length);
    }

    public getTableData(table: string, fields?: string[], expandRel?: string, filteringArgs?: any): any {
        return this._http.get(this.buildDataUrl(table, fields, expandRel, null, filteringArgs), HTTP_OPTIONS)
        .pipe(
            catchError(this.handleError)
        );
    }

    private handleError(error: HttpErrorResponse) {
        return throwError(
            'Server is not accesible: ' + error);
    }

    private _buildMetadataUrl(table: string): string {
        const baseQueryString = `${BASE_URL}/${table}/$metadata?@json`;

        return baseQueryString;
    }

    private buildDataUrl(table: string, fields?: string[], expandRel?: string,
        virtualizationArgs?: any, filteringArgs?: any, sortingArgs?: any): string {
        let baseQueryString = `${BASE_URL}/${table}?$count=true`;
        let scrollingQuery = EMPTY_STRING;
        let orderQuery = EMPTY_STRING;
        let selectQuery = EMPTY_STRING;
        let filterQuery = EMPTY_STRING;
        let expandQuery = EMPTY_STRING;
        let query = EMPTY_STRING;
        let filter = EMPTY_STRING;
        let select = EMPTY_STRING;

        if (expandRel) {
            expandQuery = `$expand=${expandRel}`;
        }

        if (fields) {
            fields.forEach((field) => {
                if (field !== EMPTY_STRING) {
                    select += `${field}, `;
                }
            });
            if (expandRel) {
                select += `${expandRel}`;
            }
            selectQuery = `$select=${select}`;
        }

        if (sortingArgs) {
            orderQuery = this._buildSortExpression(sortingArgs);
        }

        if (filteringArgs && filteringArgs.length > 0) {
            filteringArgs.forEach((columnFilter) => {
                if (filter !== EMPTY_STRING) {
                    filter += ` ${FilteringLogic[FilteringLogic.And].toLowerCase()} `;
                }

                filter += this._buildAdvancedFilterExpression(
                    columnFilter.filteringOperands,
                    columnFilter.operator);
            });

            filterQuery = `$filter=${filter}`;
        }

        if (virtualizationArgs) {
            scrollingQuery = this._buildScrollExpression(virtualizationArgs);
        }

        query += (orderQuery !== EMPTY_STRING) ? `&${orderQuery}` : EMPTY_STRING;
        query += (filterQuery !== EMPTY_STRING) ? `&${filterQuery}` : EMPTY_STRING;
        query += (scrollingQuery !== EMPTY_STRING) ? `&${scrollingQuery}` : EMPTY_STRING;
        query += (selectQuery !== EMPTY_STRING) ? `&${selectQuery}` : EMPTY_STRING;
        query += (expandQuery !== EMPTY_STRING) ? `&${expandQuery}` : EMPTY_STRING;

        baseQueryString += query;

        return baseQueryString;
    }

    private _buildAdvancedFilterExpression(operands, operator): string {
        let filterExpression = EMPTY_STRING;
        operands.forEach((operand) => {
            const value = operand.searchVal;
            const isNumberValue = (typeof (value) === 'number') ? true : false;
            const filterValue = (isNumberValue) ? value : `'${value}'`;
            const fieldName = operand.fieldName;
            let filterString;

            if (filterExpression !== EMPTY_STRING) {
                filterExpression += ` ${FilteringLogic[operator].toLowerCase()} `;
            }

            switch (operand.condition.name) {
                case 'contains': {
                    filterString = `${FILTER_OPERATION.CONTAINS}(${fieldName}, ${filterValue})`;
                    break;
                }
                case 'startsWith': {
                    filterString = `${FILTER_OPERATION.STARTS_WITH}(${fieldName},${filterValue})`;
                    break;
                }
                case 'endsWith': {
                    filterString = `${FILTER_OPERATION.ENDS_WITH}(${fieldName},${filterValue})`;
                    break;
                }
                case 'equals': {
                    filterString = `${fieldName} ${FILTER_OPERATION.EQUALS} ${filterValue} `;
                    break;
                }
                case 'doesNotEqual': {
                    filterString = `${fieldName} ${FILTER_OPERATION.DOES_NOT_EQUAL} ${filterValue} `;
                    break;
                }
                case 'doesNotContain': {
                    filterString = `${FILTER_OPERATION.DOES_NOT_CONTAIN}(${fieldName},${filterValue})`;
                    break;
                }
                case 'greaterThan': {
                    filterString = `${fieldName} ${FILTER_OPERATION.GREATER_THAN} ${filterValue} `;
                    break;
                }
                case 'greaterThanOrEqualTo': {
                    filterString = `${fieldName} ${FILTER_OPERATION.GREATER_THAN_EQUAL} ${filterValue} `;
                    break;
                }
                case 'lessThan': {
                    filterString = `${fieldName} ${FILTER_OPERATION.LESS_THAN} ${filterValue} `;
                    break;
                }
                case 'lessThanOrEqualTo': {
                    filterString = `${fieldName} ${FILTER_OPERATION.LESS_THAN_EQUAL} ${filterValue} `;
                    break;
                }
                case 'empty': {
                    filterString = `length(${fieldName}) ${FILTER_OPERATION.EQUALS} 0`;
                    break;
                }
                case 'notEmpty': {
                    filterString = `length(${fieldName}) ${FILTER_OPERATION.GREATER_THAN} 0`;
                    break;
                }
                case 'null': {
                    filterString = `${fieldName} ${FILTER_OPERATION.EQUALS} ${NULL_VALUE}`;
                    break;
                }
                case 'notNull': {
                    filterString = `${fieldName} ${FILTER_OPERATION.DOES_NOT_EQUAL} ${NULL_VALUE}`;
                    break;
                }
            }

            filterExpression += filterString;
        });

        return filterExpression;
    }

    private _buildSortExpression(sortingArgs): string {
        let sortingDirection: string;
        switch (sortingArgs.dir) {
            case SortingDirection.None: {
                sortingDirection = EMPTY_STRING;
                break;
            }
            default: {
                sortingDirection = SortingDirection[sortingArgs.dir].toLowerCase();
                break;
            }
        }

        return `$orderby=${sortingArgs.fieldName} ${sortingDirection}`;
    }

    private _buildScrollExpression(virtualizationArgs): string {
        let requiredChunkSize: number;
        const skip = virtualizationArgs.startIndex;
        requiredChunkSize = virtualizationArgs.chunkSize === 0 ? 11 : virtualizationArgs.chunkSize;
        const top = requiredChunkSize;

        return `$skip=${skip}&$top=${top}`;
    }

        // public getAllData(
    //     table: string, cb?: (any) => void): any {
    //     return this._http.get(this.buildDataUrl(table), HTTP_OPTIONS)
    //         .pipe(
    //             catchError(this.handleError)
    //         )
    //         .subscribe((data: any) => {
    //             this._remoteData.next(data.value);
    //             this.dataLength.next(data['@odata.count']);
    //             if (cb) {
    //                 cb(data);
    //             }
    //         });
    // }

    // public getFinancialData(
    //     virtualizationArgs?: IForOfState,
    //     filteringArgs?: any,
    //     sortingArgs?: any, cb?: (any) => void): any {

    //     return this._http.get(this.buildDataUrl(
    //         FINDATA_URL, null, null, virtualizationArgs, filteringArgs, sortingArgs), HTTP_OPTIONS)
    //         .pipe(
    //             catchError(this.handleError)
    //         )
    //         .subscribe((data: any) => {
    //             this._remoteData.next(data.value);
    //             if (cb) {
    //                 cb(data);
    //             }
    //         });
    // }

    // public addData(data) {
    //     const postUrl = 'http://localhost:8153/api.rsc/northwind_dbo_Products';
    //     const headers = new HttpHeaders({ 'Content-Type': 'application/json',
    //                     'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'});
    //     const options = { headers: headers, body: JSON.stringify(data[0]), url: postUrl };

    //    // this._http.post()

    //     return this._http.post(postUrl, JSON.stringify(data[0]), options)
    //     .subscribe({
    //         next: (respData: any) => {
    //             console.log(respData);
    //         },
    //         error: err => {
    //             console.log(err);
    //         }
    //     });
    // }

    // public getTables(cb?: (any) => void): any {
    //     this._http.get(this._buildTablesUrl(), HTTP_OPTIONS).subscribe((tables: any) => {
    //         if (cb) {
    //             cb(tables.value);
    //         }
    //     });
    // }

    // private _buildTablesUrl(): string {
    //     const baseQueryString = `${BASE_URL}`;
    //     return baseQueryString;
    // }
}
