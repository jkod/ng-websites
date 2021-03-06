import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { EventManagerService, Result, ScrollbarDimensionService } from 'core';
import { Photo, PhotoListQuery } from 'material-cms-view';
import { HideThrobberEvent, ShowThrobberEvent } from 'mh-throbber';
import { EMPTY, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize } from 'rxjs/operators';

@Component({
  selector: 'cms-photo-list',
  templateUrl: './photo-list.component.html',
  styleUrls: ['./photo-list.component.scss']
})
export class PhotoListComponent implements OnInit {
  @Input() allowSelection = false;
  @Input() multiple = false;
  @Input() selected: string | string[];
  @Input() showDone = false;
  @Input() title = 'Choose photo(s)';
  @Output() done = new EventEmitter<number | number[]>();
  @Output() error = new EventEmitter<Result>();
  @ViewChild('photos', { static: false }) private photosElRef: ElementRef;
  private photos: Photo[];
  private readonly gapBetweenPhotos = 6;
  private resizeStream = new Subject<number>();
  public addingNew = false;
  public dataSource: PhotoListComponent.ListItem[][] = [];

  constructor(
    private eventManagerService: EventManagerService,
    private listQuery: PhotoListQuery,
    private sanitizer: DomSanitizer,
    private scrollbarDimensionService: ScrollbarDimensionService,
  ) { }

  ngOnInit() {
    this.resizeStream.pipe(
      // wait 50ms after each resize
      debounceTime(50),

      // ignore new size if same as previous size
      distinctUntilChanged(),
    ).subscribe(containerWidth => {
      const list = this.sort_and_filter_photos();

      this.arrange_photos_in_rows(list, containerWidth);
    });

    setTimeout(() => {
      this.getPhotos();
    }, 0);
  }

  private getPhotos() {
    this.eventManagerService.raise(ShowThrobberEvent);

    this.listQuery.execute().pipe(
      catchError(err => this.onError(err)),
      finalize(() => this.eventManagerService.raise(HideThrobberEvent))
    ).subscribe(_ => this.onListQuery(_));
  }

  onResize(event) {
    this.resizeStream.next(this.getContainerWidth());
  }

  onListQuery(photos: Photo[]) {
    this.photos = photos;

    setTimeout(() => {
      const containerWidth = this.getContainerWidth();
      const list = this.sort_and_filter_photos();
      this.arrange_photos_in_rows(list, containerWidth);
    }, 10);
  }

  private sort_and_filter_photos() {
    const list = this.photos.map(x => new PhotoListComponent.ListItem(x, this.sanitizer));
    const selectedPhotos = [].concat(this.selected);

    list.forEach(photo => photo.selected = selectedPhotos.indexOf(photo.id) > -1);

    list.sort(function (a, b) {
      if (a.selected && b.selected) {
        return b.savedOn.valueOf() - a.savedOn.valueOf();
      }

      if (a.selected && !b.selected) {
        return -1;
      }

      if (!a.selected && b.selected) {
        return 1;
      }

      if (!a.selected && !b.selected) {
        return b.savedOn.valueOf() - a.savedOn.valueOf();
      }
    });

    return list;
  }

  private arrange_photos_in_rows(list: PhotoListComponent.ListItem[], containerWidth: number) {
    // We want to arrange the photos in neat little rectangles.
    // We also want to avoid re-sizing the photos as that will distort it.
    // So we will create a "viewport" showing the middle portion of the photo.

    this.dataSource = [];

    // To avoid re-sizing the photos, we set our viewport's height to the shortest photo
    const viewportHeight = Math.min.apply(null, list.map(photo => photo.height));
    // and set our viewport's height to the slimmest photo.
    let viewportWidth = Math.min.apply(null, list.map(photo => photo.width));

    // We will have a small gap between the photos; so we need to account for that.
    let viewportAndMargin = viewportWidth + this.gapBetweenPhotos;

    // How many photos can we fit into a row?
    const photoColCount = Math.floor(containerWidth / viewportAndMargin);

    // We want the photos to take up the entire row and not leave an ugly gap at the end.
    // So we will stretch the photos slightly.
    viewportAndMargin = (containerWidth / photoColCount);
    viewportWidth = viewportAndMargin - this.gapBetweenPhotos;

    // Now we start creating the rows of photos.
    while (list.length) {
      // Create a row.
      const photoRow = list.splice(0, photoColCount);

      for (let index = 0; index < photoRow.length; index++) {
        const photo = photoRow[index];

        // Set the viewport's height
        photo.viewportHeight = viewportHeight;
        // and move the photo up to vertically center it (photo.top <= 0).
        photo.top = (photo.viewportHeight - photo.height) / 2;

        // Set the viewport's width.
        // The photo on the right edge of the container won't have a right margin keeping in mind
        // that this photo may not be the last photo of the row (the last row may not be full).
        if (index < photoColCount - 1) {
          photo.viewportWidth = viewportWidth;
          photo.viewportRightMargin = this.gapBetweenPhotos;
        } else {
          photo.viewportWidth = viewportAndMargin;
        }

        if (photo.width < photo.viewportWidth) {
          // If the photo is slimmer than the viewport, stretch the photo to fit the viewport.
          photo.width = photo.viewportWidth;
        } else {
          // If the photo is wider than the viewport, move the photo left to horizontally center it (photo.left <= 0).
          photo.left = (photo.viewportWidth - photo.width) / 2;
        }
      }

      this.dataSource.push(photoRow);
    }
  }

  private getContainerWidth() {
    // Find out the width of the scroll bar
    const scrollbarDimensions = this.scrollbarDimensionService.getDimensions();
    // and subtract it from the container width.
    const containerWidth = this.photosElRef.nativeElement.clientWidth - scrollbarDimensions.width;

    return containerWidth;
  }

  onAddNewClick() {
    this.addingNew = true;
  }

  onAddingNewDone() {
    this.addingNew = false;
    this.getPhotos();
  }

  onDoneClick() {
    const selectedPhotos: number[] = [];

    this.dataSource.forEach(photoRow => {
      photoRow.forEach(photoItem => photoItem.selected && (selectedPhotos.push(photoItem.id)));
    });

    if (this.multiple) {
      this.done.emit(selectedPhotos);
    } else {
      this.done.emit(selectedPhotos[0]);
    }
  }

  onPhotoClick(photo: PhotoListComponent.ListItem) {
    if (!this.allowSelection) { return; }

    if (!this.multiple) {
      this.dataSource.forEach(photoRow => {
        photoRow.forEach(photoItem => photoItem.selected = false);
      });
    }

    photo.selected = true;

    // tslint:disable-next-line:no-unused-expression
    !this.showDone && this.onDoneClick();
  }

  onPhotoOverlayClick(photo: PhotoListComponent.ListItem) {
    if (!this.allowSelection) { return; }

    photo.selected = false;

    // tslint:disable-next-line:no-unused-expression
    !this.showDone && this.onDoneClick();
  }

  private onError(result: Result) {
    this.error.emit(result);
    return EMPTY;
  }
}

export namespace PhotoListComponent {
  export class ListItem {
    height = 0;
    id = 0;
    left = 0;
    name: string;
    savedOn: Date;
    selected = false;
    top = 0;
    url: SafeStyle;
    viewportHeight = 0;
    viewportRightMargin = 0;
    viewportWidth = 0;
    width = 0;

    constructor(model: Photo, sanitizer: DomSanitizer) {
      const thumbnail = model.bigThumbnail || model.smallThumbnail;

      this.id = model.id;
      this.savedOn = model.effectiveFrom;
      this.height = thumbnail.height;
      this.id = model.id;
      this.width = thumbnail.width;

      if (thumbnail) {
        this.name = thumbnail.name;
        this.url = sanitizer.bypassSecurityTrustStyle(`url(${thumbnail.location})`);
      }
    }
  }
}
