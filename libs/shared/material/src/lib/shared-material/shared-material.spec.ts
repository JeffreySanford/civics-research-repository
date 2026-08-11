import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedMaterial } from './shared-material';

describe('SharedMaterial', () => {
  let component: SharedMaterial;
  let fixture: ComponentFixture<SharedMaterial>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedMaterial],
    }).compileComponents();

    fixture = TestBed.createComponent(SharedMaterial);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
