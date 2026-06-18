import {LegacyOpenFlareBaseService} from './legacy-base.service';

export class AboutService extends LegacyOpenFlareBaseService {
  protected static override readonly basePath = '/api';

  static getAboutContent(): Promise<string> {
    return this.legacyGet<string>('/about');
  }
}