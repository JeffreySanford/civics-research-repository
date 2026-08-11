import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedAccessibility } from './shared-accessibility';

describe('SharedAccessibility', () => {
  let component: SharedAccessibility;
  let fixture: ComponentFixture<SharedAccessibility>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedAccessibility],
    }).compileComponents();

    fixture = TestBed.createComponent(SharedAccessibility);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
