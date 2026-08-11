import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapsVisualization } from './maps-visualization';

describe('MapsVisualization', () => {
  let component: MapsVisualization;
  let fixture: ComponentFixture<MapsVisualization>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapsVisualization],
    }).compileComponents();

    fixture = TestBed.createComponent(MapsVisualization);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
