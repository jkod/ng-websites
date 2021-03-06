import { Inject, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { EventManagerService, Result, SessionStorageService } from 'core';
import { Page, PageDatabase, SitePages, SITE_PAGES } from 'material-cms-view';
import { HideThrobberEvent, ShowThrobberEvent } from 'mh-throbber';
import { EMPTY } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { PageCreateCommand } from '../commands/page-create-command.service';
import { PageListQuery } from '../queries/page-list-query.service';

export abstract class PageListBase<TPage extends Page, TPageListItem extends PageListItem> implements OnInit {
  abstract displayedColumns: string[];
  canAddNew: boolean;
  dataSource: MatTableDataSource<TPageListItem>;
  errors: any;
  name = '';
  notFound = false;
  private kind: string;

  private _showCurrent: boolean;
  public get showCurrent(): boolean {
    return this._showCurrent;
  }
  public set showCurrent(v: boolean) {
    this._showCurrent = v;

    // tslint:disable-next-line:no-unused-expression
    v && (this._showDeleted = false);

    this.applyFilter();

    this.savePageSettings();
  }

  private _showDeleted: boolean;
  public get showDeleted(): boolean {
    return this._showDeleted;
  }
  public set showDeleted(v: boolean) {
    this._showDeleted = v;

    this.applyFilter();

    this.savePageSettings();
  }

  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;
  @ViewChild(MatSort, { static: false }) sort: MatSort;

  private storageKey: string;
  private pageSettings: { current: boolean, deleted: boolean };
  protected fullList: TPageListItem[];

  constructor(
    @Inject(SITE_PAGES) private sitePages: SitePages,
    private createCommand: PageCreateCommand,
    private eventManagerService: EventManagerService,
    private listQuery: PageListQuery,
    private route: ActivatedRoute,
    private router: Router,
    private storage: SessionStorageService,
  ) {
    this.canAddNew = true;
    this.dataSource = new MatTableDataSource<TPageListItem>();
  }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => this.onParams(params));
  }

  protected onParams(params: ParamMap) {
    this.kind = params.get('kind');
    this.name = this.kind;

    const pageInfo = this.sitePages.list.filter(p => p.link === this.kind);
    if (pageInfo.length !== 1) {
      this.notFound = true;
      this.name = 'Page Not Found';
      return;
    }

    this.name = `${pageInfo[0].name} list`;

    this.storageKey = `admin_${this.kind}_list`;

    this.pageSettings = this.storage.get(this.storageKey);

    if (this.pageSettings) {
      this._showCurrent = this.pageSettings.current;
      this._showDeleted = this.pageSettings.deleted;
    }

    this.eventManagerService.raise(ShowThrobberEvent);

    this.listQuery.execute(this.kind).pipe(
      catchError(err => this.onError(err)),
      finalize(() => this.eventManagerService.raise(HideThrobberEvent))
    ).subscribe(list => this.onListQuery(list));
  }

  onListQuery(list: PageDatabase.ListResult[]) {
    if (list.length === 0) {
      return;
    }

    this.setFullList(list);

    this.setCanAddNew();

    this.applyFilter();
  }

  protected setFullList(list: PageDatabase.ListResult[]) {
    this.fullList = list.map(x => new PageListItem(x)) as TPageListItem[];

    const now = Date.now();

    const approvedPages = this.fullList.filter(x => x.status === 'Approved' && x.effectiveFrom.valueOf() <= now);

    if (approvedPages.length > 0) {
      if (approvedPages[0].effectiveTo) {
        approvedPages.filter(x => x.effectiveTo.valueOf() >= now).forEach(x => x.current = true);
      } else {
        const mostRecentlyApproved = Math.max(...approvedPages.map(x => x.effectiveFrom.valueOf()));
        approvedPages.filter(x => x.effectiveFrom.valueOf() === mostRecentlyApproved).forEach(x => x.current = true);
      }
    }
  }

  protected setCanAddNew() {
    this.canAddNew = this.fullList.length === 0;
  }

  protected applyFilter() {
    if (this.fullList === undefined || this.fullList === null || this.fullList.length === 0) {
      return;
    }

    if (this.showCurrent) {
      this.dataSource.data = this.fullList.filter(x => x.current);
      return;
    }

    if (this.showDeleted) {
      this.dataSource.data = this.fullList;
      return;
    }

    this.dataSource.data = this.fullList.filter(x => x.status !== 'Deleted');

    window.setTimeout(() => {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    }, 0);
  }

  private savePageSettings() {
    // tslint:disable-next-line:no-unused-expression
    !this.pageSettings && (this.pageSettings = { current: true, deleted: false });
    this.pageSettings.current = this.showCurrent;
    this.pageSettings.deleted = this.showDeleted;
    this.storage.set(this.storageKey, this.pageSettings);
  }

  onRowClick(row) {
    this.router.navigate(['.', row.id], { relativeTo: this.route });
  }

  onAddNewClick() {
    this.eventManagerService.raise(ShowThrobberEvent);

    this.createCommand.execute(this.kind).pipe(
      catchError(err => this.onError(err)),
      finalize(() => this.eventManagerService.raise(HideThrobberEvent))
    ).subscribe(model => {
      this.router.navigate(['.', model.id], { relativeTo: this.route });
    });
  }

  onOKClick() {
    window.history.back();
  }

  private onError(result: Result) {
    this.errors = result.errors;
    return EMPTY;
  }
}

export class PageListItem {
  id: number;
  effectiveFrom: Date;
  effectiveTo: Date;
  status: string;
  current: boolean;

  constructor(model: PageDatabase.ListResult) {
    this.id = model.id;
    this.effectiveFrom = model.effectiveFrom;
    this.effectiveTo = model.effectiveTo;
    this.status = model.status;
    this.current = false;
  }
}
