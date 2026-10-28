import { Pipe, PipeTransform } from '@angular/core';

// No JSDoc on the class: "missing JSDoc description" warning.
@Pipe({ name: 'fxInitials' })
export class FxInitialsPipe implements PipeTransform {
  transform(name: string, max = 2): string {
    return name.split(' ').slice(0, max).map((part) => part[0]).join('');
  }
}
